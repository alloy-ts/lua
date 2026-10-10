use std::cell::RefCell;
use std::ptr;
use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::{Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType};
use napi::sys;
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::Lua as OLua;
use ottavino::{
    Callback, CallbackReturn, Executor, ExecutorMode, Fuel, StashedExecutor, StashedValue,
    ThreadMode, Variadic,
};

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// Result of a single incremental `step`: whether execution finished and the
/// executor's current mode.
#[napi(object)]
pub struct StepResult {
    /// `true` once the executor has reached a terminal (`Result`) mode.
    pub done: bool,
    /// One of "stopped" | "result" | "normal" | "suspended" | "running".
    pub mode: String,
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
///
/// Mirrors ottavino's design: the `Lua` instance owns the single GC arena (the
/// "hub"), and all execution funnels through it. GC-rooted values that must
/// survive between NAPI calls are stashed into `handles` and referred to by a
/// `usize` id (so the JS-side handle classes stay `Send`).
///
/// Field order matters: `handles`/`exec` (arena-rooted `Stashed*`) must be
/// dropped *before* `inner` (the arena), otherwise their `Drop` would touch a
/// freed arena.
#[napi]
pub struct Lua {
    handles: Arc<Mutex<Vec<StashedValue>>>,
    exec: Option<StashedExecutor>,
    inner: OLua,
}

// Registry of host (JS) callbacks. Indexed by the `usize` captured in each
// `Callback`'s closure. Lives in a `thread_local` because the JS function and
// `Env` are not `Send`; the bridge only ever runs on the JS main thread.
// The function is retained via an `napi_ref` so it survives GC between calls.
thread_local! {
    static HOST_CALLBACKS: RefCell<Vec<Option<(sys::napi_ref, Env)>>> = RefCell::new(Vec::new());
}

/// Handle to a Lua function (closure or host callback).
///
/// Internally an index into the owning `Lua`'s handle registry.
#[napi(object)]
#[derive(Clone)]
pub struct LuaFunction {
    pub id: u32,
}

/// Handle to a Lua thread / coroutine.
#[napi(object)]
#[derive(Clone)]
pub struct LuaThread {
    pub id: u32,
}

/// Handle to a Lua table.
#[napi(object)]
#[derive(Clone)]
pub struct LuaTable {
    pub id: u32,
}

/// Handle to a Lua userdata value.
#[napi(object)]
#[derive(Clone)]
pub struct LuaUserData {
    pub id: u32,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: OLua::full(),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: OLua::empty(),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: OLua::core(),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: OLua::full(),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.load_core();
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.load_io();
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.total_memory() as f64
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.gc_collect();
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let m = self.inner.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    ///
    /// Tables, functions, threads, and userdata are returned as handle objects
    /// (`LuaTable`, `LuaFunction`, `LuaThread`, `LuaUserData`) rather than
    /// placeholder strings.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles, .. } = self;

        let mut stashed_opt = None;
        let mut compile_err = None;

        inner.enter(
            |ctx| match ottavino::Closure::load(ctx, Some("eval"), code.as_bytes()) {
                Ok(closure) => {
                    let executor = ottavino::Executor::start(ctx, closure.into(), ());
                    stashed_opt = Some(ctx.stash(executor));
                }
                Err(err) => {
                    compile_err = Some(format!("Lua compile error: {err}"));
                }
            },
        );

        if let Some(err) = compile_err {
            return Err(NapiError::from_reason(err));
        }

        let stashed = stashed_opt.unwrap();

        if let Err(e) = inner.finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        inner.enter(|ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
            Ok(Ok(val)) => {
                eval_result = ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), val);
            }
            Ok(Err(err)) => {
                eval_result = Err(NapiError::from_reason(format!("Lua runtime error: {err}")));
            }
            Err(err) => {
                eval_result = Err(NapiError::from_reason(format!(
                    "Lua execution error: {err}"
                )));
            }
        });

        eval_result
    }

    /// Get a global variable from Lua environment by name.
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), val);
        });

        get_result
    }

    /// Set a global variable in Lua environment by name.
    #[napi]
    pub fn set_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut set_result: Result<(), NapiError> = Ok(());
        self.inner
            .enter(|ctx| match js_to_ottavino_value(env, ctx, value) {
                Ok(lua_val) => {
                    let key = ctx.intern(name.as_bytes());
                    if let Err(e) = ctx.globals().set(ctx, key, lua_val) {
                        set_result = Err(NapiError::from_reason(e.to_string()));
                    }
                }
                Err(e) => {
                    set_result = Err(e);
                }
            });

        set_result
    }

    /// Compile Lua source into a function handle without executing it.
    ///
    /// The returned `LuaFunction` can later be executed with `callFunction`.
    #[napi]
    pub fn compile(&mut self, name: Option<String>, code: String) -> Result<LuaFunction, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut out: Option<LuaFunction> = None;
        let mut err: Option<NapiError> = None;
        inner.enter(|ctx| match ottavino::Closure::load(ctx, name.as_deref(), code.as_bytes()) {
            Ok(closure) => {
                let func: ottavino::Function = closure.into();
                let v: ottavino::Value = func.into();
                let id = handles.lock().unwrap().len() as u32;
                handles.lock().unwrap().push(ctx.stash(v));
                out = Some(LuaFunction { id });
            }
            Err(e) => err = Some(NapiError::from_reason(format!("Lua compile error: {e}"))),
        });
        match (err, out) {
            (Some(e), _) => Err(e),
            (None, Some(f)) => Ok(f),
            (None, None) => Err(NapiError::from_reason("compile failed")),
        }
    }

    /// Start incremental execution of a function handle with the given arguments.
    ///
    /// The `Executor` is stashed on this `Lua` instance and advanced later with
    /// `step`. Once `step` reports `done`, call `result` to collect the returns.
    /// This is the basis for fuel-paced / cancellable execution: stop calling
    /// `step` to pause, or drive it from a host callback via `Fuel::interrupt`.
    #[napi]
    pub fn run<'js>(
        &mut self,
        env: &'js Env,
        func: LuaFunction,
        args: Vec<Unknown<'js>>,
    ) -> Result<(), NapiError> {
        let idx = func.id as usize;
        if idx >= self.handles.lock().unwrap().len() {
            return Err(NapiError::from_reason("invalid function handle"));
        }
        let Lua { inner, handles, exec } = self;
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[idx]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }

            let executor = Executor::start(ctx, f, Variadic(lua_args));
            *exec = Some(ctx.stash(executor));
        });

        match err {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Start incremental execution of an existing coroutine (thread) handle.
    ///
    /// Calls `Executor::run` on the thread and resumes it with `args`, then
    /// stashes the executor so it can be advanced with `step`/`resume`. This is
    /// the coroutine analogue of `run` (which takes a `LuaFunction`).
    #[napi]
    pub fn run_thread<'js>(
        &mut self,
        env: &'js Env,
        thread: LuaThread,
        args: Vec<Unknown<'js>>,
    ) -> Result<(), NapiError> {
        let idx = thread.id as usize;
        if idx >= self.handles.lock().unwrap().len() {
            return Err(NapiError::from_reason("invalid thread handle"));
        }
        let Lua { inner, handles, exec } = self;
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[idx]);
            let ottavino::Value::Thread(t) = val else {
                err = Some(NapiError::from_reason("handle is not a thread"));
                return;
            };

            let executor = match Executor::run(ctx.mutation(), t) {
                Ok(executor) => executor,
                Err(e) => {
                    err = Some(NapiError::from_reason(format!("Executor::run error: {e}")));
                    return;
                }
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }

            if let Err(e) = executor.resume(ctx, Variadic(lua_args)) {
                err = Some(NapiError::from_reason(format!("resume error: {e}")));
                return;
            }

            *exec = Some(ctx.stash(executor));
        });

        match err {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Advance execution by `fuel` units (or until a terminal mode is reached).
    ///
    /// Returns whether execution finished (`done`) and the executor's current
    /// `mode`. Loop `step` until `done`, then call `result`.
    #[napi]
    pub fn step(&mut self, fuel: i32) -> Result<StepResult, NapiError> {
        let stashed = match &self.exec {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut done = false;
        let mut mode = String::new();
        let mut err: Option<NapiError> = None;

        self.inner.enter(|ctx| {
            let executor = ctx.fetch(stashed);
            let mut f = Fuel::with(fuel);
            match executor.step(ctx, &mut f) {
                Ok(d) => done = d,
                Err(e) => {
                    err = Some(NapiError::from_reason(format!("step error: {e}")));
                    return;
                }
            }
            mode = executor_mode_str(executor.mode());
        });

        match err {
            Some(e) => Err(e),
            None => Ok(StepResult { done, mode }),
        }
    }

    /// Current mode of the in-progress execution. Errors if none is running.
    #[napi]
    pub fn mode(&mut self) -> Result<String, NapiError> {
        let stashed = match &self.exec {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };
        let mut m = String::new();
        let _ = self.inner.try_enter(|ctx| {
            let executor = ctx.fetch(stashed);
            m = executor_mode_str(executor.mode());
            Ok(())
        });
        Ok(m)
    }

    /// Take the results of a finished (Result-mode) execution.
    #[napi]
    pub fn result<'js>(&mut self, env: &'js Env) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, handles, exec } = self;
        let stashed = match exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let executor = ctx.fetch(stashed);
            match executor.take_result::<Variadic<Vec<ottavino::Value>>>(ctx) {
                Ok(Ok(variadic)) => {
                    for v in variadic.0 {
                        match ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), v) {
                            Ok(u) => out.push(u),
                            Err(e) => {
                                err = Some(e);
                                return;
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    err = Some(NapiError::from_reason(format!("Lua runtime error: {e}")));
                }
                Err(e) => {
                    err = Some(NapiError::from_reason(format!(
                        "executor not in result mode: {e}"
                    )));
                }
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }

    /// Resume a suspended execution with the given arguments.
    #[napi]
    pub fn resume<'js>(
        &mut self,
        env: &'js Env,
        args: Vec<Unknown<'js>>,
    ) -> Result<(), NapiError> {
        let Lua { inner, exec, .. } = self;
        let stashed = match exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let executor = ctx.fetch(stashed);
            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }
            if let Err(e) = executor.resume(ctx, Variadic(lua_args)) {
                err = Some(NapiError::from_reason(format!("resume error: {e}")));
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Register a host (JavaScript) callback under `name`, callable from Lua as a
    /// global function.
    ///
    /// When Lua invokes it, the JS function runs synchronously (re-entrant) with
    /// the converted Lua arguments, and its return value is converted back into
    /// Lua. Re-registering the same name overwrites the previous callback.
    #[napi]
    pub fn register<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        func: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let raw_env = env.raw();
        // Retain the JS function with an napi_ref so it survives until we drop it.
        let func_raw = func.raw();
        let mut func_ref = ptr::null_mut();
        let status = unsafe { sys::napi_create_reference(env.raw(), func_raw, 1, &mut func_ref) };
        if status != 0 {
            return Err(NapiError::from_reason("failed to retain host callback"));
        }
        let id = HOST_CALLBACKS.with(|cell| {
            let mut v = cell.borrow_mut();
            v.push(Some((func_ref, Env::from_raw(raw_env))));
            (v.len() - 1) as u32
        });

        let handles = self.handles.clone();
        let mut register_err: Option<NapiError> = None;

        self.inner.enter(|ctx| {
            let callback = Callback::from_fn(ctx.mutation(), move |ctx, _exec, mut stack| {
                HOST_CALLBACKS.with(|cell| {
                    let guard = cell.borrow();
                    let Some((func_ref, env)) = guard.get(id as usize).and_then(|o| o.as_ref()) else {
                        return;
                    };
                    let mut func_val = ptr::null_mut();
                    unsafe {
                        sys::napi_get_reference_value(env.raw(), *func_ref, &mut func_val);
                    }
                    let func = unsafe { Unknown::from_raw_unchecked(env.raw(), func_val) };

                    let mut js_args: Vec<_> = Vec::new();
                    {
                        let mut h = handles.lock().unwrap();
                        for v in &stack {
                            let u = match ottavino_value_to_js(env, ctx, &mut *h, v) {
                                Ok(u) => u,
                                Err(_) => unsafe { Unknown::from_raw_unchecked(env.raw(), ptr::null_mut()) },
                            };
                            js_args.push(u);
                        }
                    }

                    match call_js_function(env, &func, &js_args) {
                        Ok(result) => match js_to_ottavino_value(env, ctx, result) {
                            Ok(val) => {
                                stack.clear();
                                stack.push_back(val);
                            }
                            Err(_) => stack.clear(),
                        },
                        Err(_) => stack.clear(),
                    }
                });
                Ok(CallbackReturn::Return)
            });

            let key = ctx.intern(name.as_bytes());
            if ctx
                .globals()
                .set(ctx, key, ottavino::Value::from(callback))
                .is_err()
            {
                register_err = Some(NapiError::from_reason(format!(
                    "failed to register global '{name}'"
                )));
            }
        });

        match register_err {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Runs the function to completion inside a single `enter` (mirroring
    /// `Lua::finish`'s step loop) and converts each return value.
    #[napi]
    pub fn call_function<'js>(
        &mut self,
        env: &'js Env,
        func: LuaFunction,
        args: Vec<Unknown<'js>>,
    ) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[func.id as usize]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }

            let executor = Executor::start(ctx, f, Variadic(lua_args));
            let stashed = ctx.stash(executor);
            let exec = ctx.fetch(&stashed);

            loop {
                let mut fuel = Fuel::with(4096);
                match exec.step(ctx, &mut fuel) {
                    Ok(true) => break,
                    Ok(false) => {}
                    Err(e) => {
                        err = Some(NapiError::from_reason(format!("step error: {e}")));
                        return;
                    }
                }
            }

            match exec.take_result::<Variadic<Vec<ottavino::Value>>>(ctx) {
                Ok(Ok(variadic)) => {
                    for v in variadic.0 {
                        match ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), v) {
                            Ok(u) => out.push(u),
                            Err(e) => {
                                err = Some(e);
                                return;
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    err = Some(NapiError::from_reason(format!("Lua runtime error: {e}")));
                }
                Err(e) => {
                    err = Some(NapiError::from_reason(format!(
                        "Lua execution error: {e}"
                    )));
                }
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }

    /// Return the current status of a thread handle ("stopped" | "result" |
    /// "normal" | "suspended" | "waiting" | "running").
    #[napi]
    pub fn thread_status(&mut self, thread: LuaThread) -> Result<String, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut result: Option<String> = None;
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[thread.id as usize]);
            match val {
                ottavino::Value::Thread(t) => result = Some(thread_mode_str(t.mode())),
                _ => err = Some(NapiError::from_reason("handle is not a thread")),
            }
        });

        match (err, result) {
            (Some(e), _) => Err(e),
            (None, Some(s)) => Ok(s),
            (None, None) => Err(NapiError::from_reason("no thread status")),
        }
    }

    /// Take the results of a finished (Result-mode) thread handle.
    #[napi]
    pub fn thread_take_result<'js>(
        &mut self,
        env: &'js Env,
        thread: LuaThread,
    ) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[thread.id as usize]);
            let ottavino::Value::Thread(t) = val else {
                err = Some(NapiError::from_reason("handle is not a thread"));
                return;
            };

            match t.take_result::<Variadic<Vec<ottavino::Value>>>(ctx) {
                Ok(Ok(variadic)) => {
                    for v in variadic.0 {
                        match ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), v) {
                            Ok(u) => out.push(u),
                            Err(e) => {
                                err = Some(e);
                                return;
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    err = Some(NapiError::from_reason(format!("Lua runtime error: {e}")));
                }
                Err(e) => {
                    err = Some(NapiError::from_reason(format!("bad thread mode: {e}")));
                }
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }

    /// Read a field from a table handle.
    #[napi]
    pub fn table_get<'js>(
        &mut self,
        env: &'js Env,
        table: LuaTable,
        key: Unknown<'js>,
    ) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("table_get failed"));

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match js_to_ottavino_value(env, ctx, key) {
                Ok(k) => {
                    let v = t.get_value(ctx, k);
                    result = ottavino_value_to_js(env, ctx, &mut *handles.lock().unwrap(), v);
                }
                Err(e) => result = Err(e),
            }
        });

        result
    }

    /// Write a field on a table handle.
    #[napi]
    pub fn table_set(
        &mut self,
        env: &Env,
        table: LuaTable,
        key: Unknown,
        value: Unknown,
    ) -> Result<(), NapiError> {
        let Lua { inner, handles, .. } = self;
        let mut result: Result<(), NapiError> = Ok(());

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match (
                js_to_ottavino_value(env, ctx, key),
                js_to_ottavino_value(env, ctx, value),
            ) {
                (Ok(k), Ok(v)) => {
                    if let Err(e) = t.set(ctx, k, v) {
                        result = Err(NapiError::from_reason(e.to_string()));
                    }
                }
                (Err(e), _) | (_, Err(e)) => result = Err(e),
            }
        });

        result
    }
}

fn executor_mode_str(m: ExecutorMode) -> String {
    match m {
        ExecutorMode::Stopped => "stopped",
        ExecutorMode::Result => "result",
        ExecutorMode::Normal => "normal",
        ExecutorMode::Suspended => "suspended",
        ExecutorMode::Running => "running",
    }
    .to_string()
}

fn thread_mode_str(m: ThreadMode) -> String {
    match m {
        ThreadMode::Stopped => "stopped",
        ThreadMode::Result => "result",
        ThreadMode::Normal => "normal",
        ThreadMode::Suspended => "suspended",
        ThreadMode::Waiting => "waiting",
        ThreadMode::Running => "running",
    }
    .to_string()
}

/// Wrap a handle struct into an `Unknown` JS value.
fn handle_to_unknown<'js, T: ToNapiValue>(
    env: &'js Env,
    h: T,
) -> Result<Unknown<'js>, NapiError> {
    h.into_unknown(env)
}

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
    handles: &mut Vec<StashedValue>,
    val: ottavino::Value<'gc>,
) -> Result<Unknown<'js>, NapiError> {
    match val {
        ottavino::Value::Nil => ().into_unknown(env),
        ottavino::Value::Boolean(b) => b.into_unknown(env),
        ottavino::Value::Integer(i) => i.into_unknown(env),
        ottavino::Value::Number(n) => n.into_unknown(env),
        ottavino::Value::String(s) => {
            let str_val = String::from_utf8_lossy(s.as_bytes());
            env.create_string(&str_val)?.into_unknown(env)
        }
        ottavino::Value::Table(_) => {
            let id = handles.len() as u32;
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaTable { id })
        }
        ottavino::Value::Function(_) => {
            let id = handles.len() as u32;
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaFunction { id })
        }
        ottavino::Value::Thread(_) => {
            let id = handles.len() as u32;
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaThread { id })
        }
        ottavino::Value::UserData(_) => {
            let id = handles.len() as u32;
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaUserData { id })
        }
    }
}

fn js_to_ottavino_value<'gc>(
    env: &Env,
    ctx: ottavino::Context<'gc>,
    js_val: Unknown,
) -> Result<ottavino::Value<'gc>, NapiError> {
    let value_type = js_val.get_type()?;
    match value_type {
        ValueType::Undefined | ValueType::Null => Ok(ottavino::Value::Nil),
        ValueType::Boolean => {
            let b = unsafe { bool::from_napi_value(env.raw(), js_val.raw())? };
            Ok(ottavino::Value::Boolean(b))
        }
        ValueType::Number => {
            let n = unsafe { f64::from_napi_value(env.raw(), js_val.raw())? };
            if n.fract() == 0.0 && n >= (i64::MIN as f64) && n <= (i64::MAX as f64) {
                Ok(ottavino::Value::Integer(n as i64))
            } else {
                Ok(ottavino::Value::Number(n))
            }
        }
        ValueType::String => {
            let s = unsafe { String::from_napi_value(env.raw(), js_val.raw())? };
            let interned = ctx.intern(s.as_bytes());
            Ok(ottavino::Value::String(interned))
        }
        ValueType::Object => {
            if js_val.is_array()? {
                let js_arr = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let len = js_arr.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let elem: Unknown = js_arr.get_element(i)?;
                    let lua_elem = js_to_ottavino_value(env, ctx, elem)?;
                    table
                        .set(ctx, (i + 1) as i64, lua_elem)
                        .map_err(|e| NapiError::from_reason(e.to_string()))?;
                }
                Ok(ottavino::Value::Table(table))
            } else {
                let js_obj = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let names = js_obj.get_property_names()?;
                let len = names.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let prop_name: String = names.get_element(i)?;
                    let prop_val: Unknown =
                        js_obj.get_property(names.get_element::<Unknown>(i)?)?;
                    let lua_val = js_to_ottavino_value(env, ctx, prop_val)?;
                    let interned_key = ctx.intern(prop_name.as_bytes());
                    table
                        .set(ctx, interned_key, lua_val)
                        .map_err(|e| NapiError::from_reason(e.to_string()))?;
                }
                Ok(ottavino::Value::Table(table))
            }
        }
        _ => Ok(ottavino::Value::Nil),
    }
}

/// Call a JS function synchronously (re-entrant) with already-converted `Unknown`
/// arguments, returning the JS result as an `Unknown`. Uses the raw napi call
/// because `Unknown` does not implement `NapiRaw` (so `JsFunction::call`'s
/// `V: NapiRaw` bound cannot be satisfied by `&[Unknown]`).
fn call_js_function<'a>(
    env: &Env,
    func: &Unknown,
    args: &[Unknown<'a>],
) -> Result<Unknown<'a>, NapiError> {
    let env_raw = env.raw();
    let func_raw = func.raw();
    let mut this = ptr::null_mut();
    unsafe {
        sys::napi_get_undefined(env_raw, &mut this);
    }
    let argv: Vec<sys::napi_value> = args.iter().map(|a| a.raw()).collect();
    let mut result = ptr::null_mut();
    let status = unsafe {
        sys::napi_call_function(
            env_raw,
            this,
            func_raw,
            argv.len(),
            argv.as_ptr(),
            &mut result,
        )
    };
    if status == 0 {
        Ok(unsafe { Unknown::from_raw_unchecked(env_raw, result) })
    } else {
        // Clear any pending JS exception so it doesn't leak into the caller.
        let mut exc = ptr::null_mut();
        unsafe {
            sys::napi_get_and_clear_last_exception(env_raw, &mut exc);
        }
        Err(NapiError::from_reason(
            "JS host callback threw an exception",
        ))
    }
}
