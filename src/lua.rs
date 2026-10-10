use std::cell::RefCell;
use std::ptr;
use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::{Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType};
use napi::sys;
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::table::NextValue;
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
    inner: Arc<Mutex<OLua>>,
}

/// Handle to global variables table (_ENV).
#[napi]
pub struct Globals {
    inner: Arc<Mutex<OLua>>,
    handles: Arc<Mutex<Vec<StashedValue>>>,
}

#[napi]
impl Globals {
    /// Retrieves a global variable from the Lua environment.
    #[napi]
    pub fn get<'js>(&self, env: &'js Env, name: String) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        self.inner.lock().unwrap().enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, &self.handles, val);
        });

        get_result
    }

    /// Binds a global variable in the Lua environment. Converts primitives, JS objects/arrays to Lua tables, and JS functions to callable Ottavino `Callback`s.
    #[napi]
    pub fn set<'js>(
        &self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut set_result: Result<(), NapiError> = Ok(());
        let handles = self.handles.clone();
        self.inner
            .lock()
            .unwrap()
            .enter(|ctx| match js_to_ottavino_value(env, ctx, &handles, value) {
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
        Self::full()
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::empty())),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        let mut inner = OLua::core();
        inner.load_core();
        Lua {
            inner: Arc::new(Mutex::new(inner)),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        let mut inner = OLua::full();
        inner.load_core();
        inner.load_io();
        Lua {
            inner: Arc::new(Mutex::new(inner)),
            handles: Arc::new(Mutex::new(Vec::new())),
            exec: None,
        }
    }

    /// Returns the `Globals` handle for interacting with global variables (`_ENV` / `ctx.globals()`), mirroring Ottavino's Rust API.
    #[napi]
    pub fn globals(&self) -> Globals {
        Globals {
            inner: self.inner.clone(),
            handles: self.handles.clone(),
        }
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.lock().unwrap().load_core();
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.lock().unwrap().load_io();
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.lock().unwrap().total_memory() as f64
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.lock().unwrap().gc_collect();
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let inner = self.inner.lock().unwrap();
        let m = inner.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let handles = self.handles.clone();
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.lock().unwrap().enter(
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

        if let Err(e) = self.inner.lock().unwrap().finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        self.inner.lock().unwrap().enter(|ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
            Ok(Ok(val)) => {
                eval_result = ottavino_value_to_js(env, ctx, &handles, val);
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

    /// Compile Lua source into a function handle without executing it.
    ///
    /// The returned `LuaFunction` can later be executed with `callFunction`.
    #[napi]
    pub fn compile(&mut self, name: Option<String>, code: String) -> Result<LuaFunction, NapiError> {
        let handles = self.handles.clone();
        let mut out: Option<LuaFunction> = None;
        let mut err: Option<NapiError> = None;
        self.inner.lock().unwrap().enter(|ctx| match ottavino::Closure::load(ctx, name.as_deref(), code.as_bytes()) {
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
        let handles = self.handles.clone();
        let mut err: Option<NapiError> = None;
        let mut exec_opt = None;

        self.inner.lock().unwrap().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[idx]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, &handles, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }

            let executor = Executor::start(ctx, f, Variadic(lua_args));
            exec_opt = Some(ctx.stash(executor));
        });

        if let Some(e) = exec_opt {
            self.exec = Some(e);
        }

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
        let handles = self.handles.clone();
        let mut err: Option<NapiError> = None;
        let mut exec_opt = None;

        self.inner.lock().unwrap().enter(|ctx| {
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
                match js_to_ottavino_value(env, ctx, &handles, a.clone()) {
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

            exec_opt = Some(ctx.stash(executor));
        });

        if let Some(e) = exec_opt {
            self.exec = Some(e);
        }

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

        self.inner.lock().unwrap().enter(|ctx| {
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
        self.inner.lock().unwrap().enter(|ctx| {
            let executor = ctx.fetch(stashed);
            m = executor_mode_str(executor.mode());
        });
        Ok(m)
    }

    /// Take the results of a finished (Result-mode) execution.
    #[napi]
    pub fn result<'js>(&mut self, env: &'js Env) -> Result<Vec<Unknown<'js>>, NapiError> {
        let handles = self.handles.clone();
        let stashed = match self.exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        self.inner.lock().unwrap().enter(|ctx| {
            let executor = ctx.fetch(stashed);
            match executor.take_result::<Variadic<Vec<ottavino::Value>>>(ctx) {
                Ok(Ok(variadic)) => {
                    for v in variadic.0 {
                        match ottavino_value_to_js(env, ctx, &handles, v) {
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
        let handles = self.handles.clone();
        let stashed = match self.exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut err: Option<NapiError> = None;

        self.inner.lock().unwrap().enter(|ctx| {
            let executor = ctx.fetch(stashed);
            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, &handles, a.clone()) {
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

    /// Runs the function to completion inside a single `enter` (mirroring
    /// `Lua::finish`'s step loop) and converts each return value.
    #[napi]
    pub fn call_function<'js>(
        &mut self,
        env: &'js Env,
        func: LuaFunction,
        args: Vec<Unknown<'js>>,
    ) -> Result<Vec<Unknown<'js>>, NapiError> {
        let handles = self.handles.clone();
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        self.inner.lock().unwrap().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[func.id as usize]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, &handles, a.clone()) {
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
                        match ottavino_value_to_js(env, ctx, &handles, v) {
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
        let handles = self.handles.clone();
        let mut result: Option<String> = None;
        let mut err: Option<NapiError> = None;

        self.inner.lock().unwrap().enter(|ctx| {
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
        let handles = self.handles.clone();
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        self.inner.lock().unwrap().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[thread.id as usize]);
            let ottavino::Value::Thread(t) = val else {
                err = Some(NapiError::from_reason("handle is not a thread"));
                return;
            };

            match t.take_result::<Variadic<Vec<ottavino::Value>>>(ctx) {
                Ok(Ok(variadic)) => {
                    for v in variadic.0 {
                        match ottavino_value_to_js(env, ctx, &handles, v) {
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
        let handles = self.handles.clone();
        let mut result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("table_get failed"));

        self.inner.lock().unwrap().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match js_to_ottavino_value(env, ctx, &handles, key) {
                Ok(k) => {
                    let v = t.get_value(ctx, k);
                    result = ottavino_value_to_js(env, ctx, &handles, v);
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
        let handles = self.handles.clone();
        let mut result: Result<(), NapiError> = Ok(());

        self.inner.lock().unwrap().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match (
                js_to_ottavino_value(env, ctx, &handles, key),
                js_to_ottavino_value(env, ctx, &handles, value),
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

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
    handles: &Arc<Mutex<Vec<StashedValue>>>,
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
        ottavino::Value::Table(t) => {
            let len = t.length();
            if len > 0 {
                let mut js_arr = env.create_array(len as u32)?;
                for i in 1..=len {
                    let v = t.get_value(ctx, i);
                    let js_v = ottavino_value_to_js(env, ctx, handles, v)?;
                    js_arr.set_element((i - 1) as u32, js_v)?;
                }
                js_arr.into_unknown(env)
            } else {
                let mut js_obj = Object::new(env)?;
                let mut key = ottavino::Value::Nil;
                while let NextValue::Found { key: k, value: v } = t.next(key) {
                    key = k;
                    let k_str = match k {
                        ottavino::Value::String(s) => {
                            String::from_utf8_lossy(s.as_bytes()).to_string()
                        }
                        ottavino::Value::Integer(i) => i.to_string(),
                        ottavino::Value::Number(n) => n.to_string(),
                        ottavino::Value::Boolean(b) => b.to_string(),
                        _ => continue,
                    };
                    let js_v = ottavino_value_to_js(env, ctx, handles, v)?;
                    js_obj.set_named_property(&k_str, js_v)?;
                }
                js_obj.into_unknown(env)
            }
        }
        ottavino::Value::Function(_) => env.create_string("[lua function]")?.into_unknown(env),
        ottavino::Value::Thread(_) => env.create_string("[lua thread]")?.into_unknown(env),
        ottavino::Value::UserData(_) => env.create_string("[lua userdata]")?.into_unknown(env),
    }
}

fn js_to_ottavino_value<'gc>(
    env: &Env,
    ctx: ottavino::Context<'gc>,
    handles: &Arc<Mutex<Vec<StashedValue>>>,
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
        ValueType::Function => {
            let raw_env = env.raw();
            let func_raw = js_val.raw();
            let mut func_ref = ptr::null_mut();
            let status =
                unsafe { sys::napi_create_reference(env.raw(), func_raw, 1, &mut func_ref) };
            if status != 0 {
                return Err(NapiError::from_reason("failed to retain host callback"));
            }
            let id = HOST_CALLBACKS.with(|cell| {
                let mut v = cell.borrow_mut();
                v.push(Some((func_ref, Env::from_raw(raw_env))));
                (v.len() - 1) as u32
            });

            let handles_cb = handles.clone();
            let callback = Callback::from_fn(ctx.mutation(), move |ctx, _exec, mut stack| {
                HOST_CALLBACKS.with(|cell| {
                    let guard = cell.borrow();
                    let Some((func_ref, env)) = guard.get(id as usize).and_then(|o| o.as_ref())
                    else {
                        return Ok(CallbackReturn::Return);
                    };
                    let mut func_val = ptr::null_mut();
                    unsafe {
                        sys::napi_get_reference_value(env.raw(), *func_ref, &mut func_val);
                    }
                    let func = unsafe { Unknown::from_raw_unchecked(env.raw(), func_val) };

                    let mut js_args: Vec<_> = Vec::with_capacity(stack.len());
                    for i in 0..stack.len() {
                        let v = stack.get(i);
                        let u = match ottavino_value_to_js(env, ctx, &handles_cb, v) {
                            Ok(u) => u,
                            Err(e) => {
                                return Err(
                                    ottavino::RuntimeError::from(anyhow::anyhow!(e.reason)).into(),
                                );
                            }
                        };
                        js_args.push(u);
                    }

                    match call_js_function(env, &func, &js_args) {
                        Ok(result) => match js_to_ottavino_value(env, ctx, &handles_cb, result) {
                            Ok(val) => {
                                stack.clear();
                                stack.push_back(val);
                                Ok(CallbackReturn::Return)
                            }
                            Err(e) => Err(ottavino::RuntimeError::from(anyhow::anyhow!(
                                e.reason
                            ))
                            .into()),
                        },
                        Err(e) => {
                            Err(ottavino::RuntimeError::from(anyhow::anyhow!(e.reason)).into())
                        }
                    }
                })
            });

            Ok(ottavino::Value::from(callback))
        }
        ValueType::Object => {
            if js_val.is_array()? {
                let js_arr = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let len = js_arr.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let elem: Unknown = js_arr.get_element(i)?;
                    let lua_elem = js_to_ottavino_value(env, ctx, handles, elem)?;
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
                    let lua_val = js_to_ottavino_value(env, ctx, handles, prop_val)?;
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
        let exc_str = if !exc.is_null() {
            let exc_val = unsafe { Unknown::from_raw_unchecked(env_raw, exc) };
            if let Ok(s) = unsafe { String::from_napi_value(env_raw, exc_val.raw()) } {
                s
            } else if let Ok(obj) = unsafe { Object::from_napi_value(env_raw, exc_val.raw()) } {
                if let Ok(msg) = obj.get_named_property::<String>("message") {
                    msg
                } else {
                    "JS host callback threw an exception".to_string()
                }
            } else {
                "JS host callback threw an exception".to_string()
            }
        } else {
            "JS host callback threw an exception".to_string()
        };
        Err(NapiError::from_reason(exc_str))
    }
}
