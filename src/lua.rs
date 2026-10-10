use std::cell::{RefCell, UnsafeCell};
use std::ptr;
use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::{
    ClassInstance, Env, FromNapiValue, JavaScriptClassExt, JsObjectValue, Object, ToNapiValue,
    ValueType,
};
use napi::sys;
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::Lua as OLua;
use ottavino::{
    BoxSequence, Callback, CallbackReturn, Context, Execution, Executor, ExecutorMode, Fuel,
    Sequence, SequencePoll, StashedExecutor, StashedValue, ThreadMode, Variadic,
};
use ottavino_gc_arena::Collect;

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
/// Shared state behind a `Lua` instance and any `Globals` handles derived from it.
///
/// Field order matters for drop: `handles` (the GC roots) must be released
/// before `lua` (the arena they point into) is torn down.
struct Inner {
    handles: Arc<Mutex<Vec<StashedValue>>>,
    lua: UnsafeCell<OLua>,
}

// SAFETY: the arena is only ever touched from the JS main thread (every bridge
// entry point is a synchronous napi call on that thread), so handing out
// `&mut OLua` from `&Inner` never races. Re-entrant use (a host callback
// touching `Globals` while the outer `enter` is suspended) is likewise
// single-threaded and does not overlap accesses.
unsafe impl Sync for Inner {}

impl Inner {
    /// Exclusive access to the arena wrapper.
    ///
    /// `ottavino::Lua::enter` needs `&mut self` (it may run GC), so sharing the
    /// arena across `Lua`/`Globals` goes through this cell rather than `Arc`
    /// exclusivity. Only the JS main thread ever calls it, so there is no
    /// simultaneous borrow; a re-entrant call happens while the outer `enter`
    /// is suspended at a host-callback boundary.
    fn arena(&self) -> &mut OLua {
        // SAFETY: single-threaded access; see the `Sync` safety comment above.
        unsafe { &mut *self.lua.get() }
    }
}

#[napi]
pub struct Lua {
    exec: Option<StashedExecutor>,
    inner: Arc<Inner>,
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

/// Handle to a Lua environment's globals table (`_ENV`).
///
/// Obtained via `Lua::globals()`. Mirrors ottavino's `ctx.globals()`.
#[napi]
pub struct Globals {
    inner: Arc<Inner>,
}

#[napi]
impl Globals {
    /// Get a global variable from the Lua environment.
    ///
    /// Tables/functions/threads/userdata come back as handle objects
    /// (`LuaTable`, `LuaFunction`, ...), like `Lua::eval`.
    #[napi]
    pub fn get<'js>(&self, env: &'js Env, name: String) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        self.inner.arena().enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result =
                ottavino_value_to_js(env, ctx, &mut *self.inner.handles.lock().unwrap(), val);
        });
        get_result
    }

    /// Bind a global variable in the Lua environment.
    ///
    /// Converts primitives directly, JS objects/arrays to Lua tables, and JS
    /// functions to callable ottavino `Callback`s that re-entrantly invoke them.
    #[napi]
    pub fn set<'js>(&self, env: &'js Env, name: String, value: Unknown<'js>) -> Result<(), NapiError> {
        self.inner
            .arena()
            .enter(|ctx| -> Result<(), NapiError> {
                let lua_val = js_to_ottavino_value(env, ctx, &self.inner.handles, value)?;
                let key = ctx.intern(name.as_bytes());
                ctx.globals()
                    .set(ctx, key, lua_val)
                    .map(|_| ())
                    .map_err(|e| NapiError::from_reason(e.to_string()))
            })
    }
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            exec: None,
            inner: Arc::new(Inner {
                handles: Arc::new(Mutex::new(Vec::new())),
                lua: UnsafeCell::new(OLua::full()),
            }),
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            exec: None,
            inner: Arc::new(Inner {
                handles: Arc::new(Mutex::new(Vec::new())),
                lua: UnsafeCell::new(OLua::empty()),
            }),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            exec: None,
            inner: Arc::new(Inner {
                handles: Arc::new(Mutex::new(Vec::new())),
                lua: UnsafeCell::new(OLua::core()),
            }),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            exec: None,
            inner: Arc::new(Inner {
                handles: Arc::new(Mutex::new(Vec::new())),
                lua: UnsafeCell::new(OLua::full()),
            }),
        }
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.arena().load_core();
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.arena().load_io();
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.arena().total_memory() as f64
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.arena().gc_collect();
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let m = self.inner.arena().gc_metrics();
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;

        let mut stashed_opt = None;
        let mut compile_err = None;

        inner.arena().enter(
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

        if let Err(e) = inner.arena().finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        inner.arena().enter(|ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
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

    /// Get a handle to this Lua environment's globals table (`_ENV`).
    ///
    /// Mirrors ottavino's `ctx.globals()`: use `globals.get(name)` / `globals.set(name, value)`.
    #[napi]
    pub fn globals<'js>(
        &self,
        env: &'js Env,
    ) -> Result<ClassInstance<'js, Globals>, NapiError> {
        Globals {
            inner: self.inner.clone(),
        }
        .into_instance(env)
    }

    /// Compile Lua source into a function handle without executing it.
    ///
    /// The returned `LuaFunction` can later be executed with `callFunction`.
    #[napi]
    pub fn compile(&mut self, name: Option<String>, code: String) -> Result<LuaFunction, NapiError> {
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut out: Option<LuaFunction> = None;
        let mut err: Option<NapiError> = None;
        inner.arena().enter(|ctx| match ottavino::Closure::load(ctx, name.as_deref(), code.as_bytes()) {
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
        if idx >= self.inner.handles.lock().unwrap().len() {
            return Err(NapiError::from_reason("invalid function handle"));
        }
        let Lua { inner, exec, .. } = self;
        let handles = &inner.handles;
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[idx]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, handles, a.clone()) {
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
        if idx >= self.inner.handles.lock().unwrap().len() {
            return Err(NapiError::from_reason("invalid thread handle"));
        }
        let Lua { inner, exec, .. } = self;
        let handles = &inner.handles;
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
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
                match js_to_ottavino_value(env, ctx, handles, a.clone()) {
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

        self.inner.arena().enter(|ctx| {
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
        let _ = self.inner.arena().try_enter(|ctx| {
            let executor = ctx.fetch(stashed);
            m = executor_mode_str(executor.mode());
            Ok(())
        });
        Ok(m)
    }

    /// The pending host Promise a yielded execution is waiting on, if any.
    ///
    /// When a host callback returns a Promise, the Lua executor yields
    /// (`step` → not done). Drive it from JS like:
    ///
    /// ```js
    /// const p = lua.pendingPromise();
    /// if (p) await p;      // let the promise's `.then` capture run
    /// lua.step();          // resume; the sequence now completes
    /// ```
    ///
    /// Returns `undefined` when no host promise is pending.
    #[napi]
    pub fn pending_promise<'js>(&self, env: &'js Env) -> Result<Unknown<'js>, NapiError> {
        let found = PROMISE_SLOTS.with(|cell| {
            let v = cell.borrow();
            v.iter()
                .find(|s| matches!(s.state, PromiseState::Pending))
                .map(|s| (s.env_raw, s.promise_ref))
        });
        match found {
            Some((env_raw, promise_ref)) => {
                let mut promise = ptr::null_mut();
                unsafe {
                    sys::napi_get_reference_value(env_raw, promise_ref, &mut promise);
                }
                if promise.is_null() {
                    Ok(().into_unknown(env)?)
                } else {
                    Ok(unsafe { Unknown::from_raw_unchecked(env_raw, promise) })
                }
            }
            None => Ok(().into_unknown(env)?),
        }
    }

    /// Fulfill the oldest pending host Promise with `value`.
    ///
    /// After awaiting the value from `pending_promise()`, pass it here so the
    /// suspended Lua execution can continue on the next `step`.
    #[napi]
    pub fn resolve_promise<'js>(&self, _env: &'js Env, value: Unknown<'js>) -> Result<(), NapiError> {
        let value_raw = value.raw();
        PROMISE_SLOTS.with(|cell| {
            let mut v = cell.borrow_mut();
            if let Some(s) = v.iter_mut().find(|s| matches!(s.state, PromiseState::Pending)) {
                let mut value_ref = ptr::null_mut();
                unsafe {
                    sys::napi_create_reference(s.env_raw, value_raw, 1, &mut value_ref);
                    sys::napi_delete_reference(s.env_raw, s.promise_ref);
                }
                s.promise_ref = ptr::null_mut();
                s.state = PromiseState::Fulfilled(value_ref);
            }
        });
        Ok(())
    }

    /// Take the results of a finished (Result-mode) execution.
    #[napi]
    pub fn result<'js>(&mut self, env: &'js Env) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, exec, .. } = self;
        let handles = &inner.handles;
        let stashed = match exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
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
        let handles = &inner.handles;
        let stashed = match exec.as_ref() {
            Some(s) => s,
            None => return Err(NapiError::from_reason("no execution in progress")),
        };

        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
            let executor = ctx.fetch(stashed);
            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, handles, a.clone()) {
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
        let handles = self.inner.handles.clone();
        self.inner
            .arena()
            .enter(|ctx| -> Result<(), NapiError> {
                let callback = make_host_callback(env, ctx, &handles, &func);
                let key = ctx.intern(name.as_bytes());
                ctx.globals()
                    .set(ctx, key, ottavino::Value::from(callback))
                    .map(|_| ())
                    .map_err(|e| NapiError::from_reason(e.to_string()))
            })
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[func.id as usize]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, handles, a.clone()) {
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut result: Option<String> = None;
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.arena().enter(|ctx| {
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("table_get failed"));

        inner.arena().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match js_to_ottavino_value(env, ctx, handles, key) {
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
        let Lua { inner, .. } = self;
        let handles = &inner.handles;
        let mut result: Result<(), NapiError> = Ok(());

        inner.arena().enter(|ctx| {
            let val = ctx.fetch(&handles.lock().unwrap()[table.id as usize]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match (
                js_to_ottavino_value(env, ctx, handles, key),
                js_to_ottavino_value(env, ctx, handles, value),
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
    handles: &Arc<Mutex<Vec<StashedValue>>>,
    js_val: Unknown,
) -> Result<ottavino::Value<'gc>, NapiError> {
    let value_type = js_val.get_type()?;
    match value_type {
        // A JS function becomes a callable Lua `Callback` that re-entrantly
        // invokes it (mirrors ottavino's `Value::from(Callback)`).
        ValueType::Function => {
            let cb = make_host_callback(env, ctx, handles, &js_val);
            Ok(ottavino::Value::from(cb))
        }
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
        Err(NapiError::from_reason(
            "JS host callback threw an exception",
        ))
    }
}

/// Build an ottavino `Callback` that re-entrantly invokes a JS function.
///
/// The function is retained via an `napi_ref` (stored in `HOST_CALLBACKS`) so it
/// survives GC between invocations. When Lua calls the callback, its arguments are
/// converted to JS, the function is invoked synchronously, and the result is
/// converted back to Lua. Used by `Lua::register` and by the JS-function case of
/// the JS→Lua converter (so `Globals::set` can bind a JS function as a Lua global).
fn make_host_callback<'gc>(
    env: &Env,
    ctx: ottavino::Context<'gc>,
    handles: &Arc<Mutex<Vec<StashedValue>>>,
    func: &Unknown,
) -> ottavino::Callback<'gc> {
    let raw_env = env.raw();
    let func_raw = func.raw();
    let mut func_ref = ptr::null_mut();
    // On failure `func_ref` is null; the callback then resolves to a missing entry
    // and returns no values, which is the safe degradation.
    unsafe {
        sys::napi_create_reference(env.raw(), func_raw, 1, &mut func_ref);
    }
    let id = HOST_CALLBACKS.with(|cell| {
        let mut v = cell.borrow_mut();
        v.push(Some((func_ref, Env::from_raw(raw_env))));
        (v.len() - 1) as u32
    });

    let handles = handles.clone();
    Callback::from_fn(ctx.mutation(), move |ctx, _exec, mut stack| {
        let seq = HOST_CALLBACKS.with(|cell| {
            let guard = cell.borrow();
            let Some((func_ref, env)) = guard.get(id as usize).and_then(|o| o.as_ref()) else {
                return None;
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
                Ok(result) => {
                    if is_promise(env, &result) {
                        return Some(build_promise_sequence(ctx, env, &result, &handles));
                    }
                    match js_to_ottavino_value(env, ctx, &handles, result) {
                        Ok(val) => {
                            stack.clear();
                            stack.push_back(val);
                        }
                        Err(_) => stack.clear(),
                    }
                }
                Err(_) => stack.clear(),
            }
            None
        });
        match seq {
            Some(s) => Ok(CallbackReturn::Sequence(s)),
            None => Ok(CallbackReturn::Return),
        }
    })
}

/// Wrap a JS Promise in a Lua-suspendable `Sequence` that resolves when it settles.
fn build_promise_sequence<'gc>(
    ctx: Context<'gc>,
    env: &Env,
    promise: &Unknown,
    handles: &Arc<Mutex<Vec<StashedValue>>>,
) -> BoxSequence<'gc> {
    let slot = track_promise(env, promise);
    BoxSequence::new(
        ctx.mutation(),
        PromiseSequence {
            slot,
            handles: handles.clone(),
        },
    )
}

// ---------------------------------------------------------------------------
// Phase 4: async host callbacks (promise-returning JS).
//
// When a host callback's JS function returns a Promise, we cannot block waiting
// for it (that would stall the event loop). Instead the callback yields the Lua
// executor via `CallbackReturn::Sequence`; a `PromiseSequence` polls a slot that
// a `.then` capture handler fills when the promise settles. The embedder drives
// this by calling `step`, and when it yields awaiting a pending promise exposed
// by `Lua::pending_promise`, awaiting it, then `step` again.
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
enum PromiseState {
    Pending,
    /// Holds a retained `napi_ref` to the resolved value.
    Fulfilled(sys::napi_ref),
    Rejected,
}

struct PromiseSlot {
    promise_ref: sys::napi_ref,
    env_raw: sys::napi_env,
    state: PromiseState,
}

thread_local! {
    static PROMISE_SLOTS: RefCell<Vec<PromiseSlot>> = RefCell::new(Vec::new());
}

/// Register `promise` as a new pending slot (retained so it survives GC) and
/// return its id. Resolution is driven by the embedder via `Lua::resolve_promise`.
fn track_promise(env: &Env, promise: &Unknown) -> usize {
    let env_raw = env.raw();
    let promise_raw = promise.raw();
    let mut promise_ref = ptr::null_mut();
    unsafe {
        sys::napi_create_reference(env_raw, promise_raw, 1, &mut promise_ref);
    }
    PROMISE_SLOTS.with(|cell| {
        let mut v = cell.borrow_mut();
        v.push(PromiseSlot {
            promise_ref,
            env_raw,
            state: PromiseState::Pending,
        });
        v.len() - 1
    })
}

/// True if the JS value is a Promise.
fn is_promise(env: &Env, value: &Unknown) -> bool {
    let mut flag = false;
    unsafe {
        sys::napi_is_promise(env.raw(), value.raw(), &mut flag);
    }
    flag
}

/// A Lua suspension point backed by a JS Promise settling.
struct PromiseSequence {
    slot: usize,
    handles: Arc<Mutex<Vec<StashedValue>>>,
}

// The slot id and the shared handles need no GC tracing (handles are arena roots
// tracked separately; the id is a plain integer), so `Collect` is a no-op.
unsafe impl Collect for PromiseSequence {
    fn needs_trace() -> bool {
        false
    }
    fn trace(&self, _cc: &ottavino_gc_arena::Collection) {}
}

impl<'gc> Sequence<'gc> for PromiseSequence {
    fn poll(
        self: std::pin::Pin<&mut Self>,
        ctx: Context<'gc>,
        _exec: Execution<'gc, '_>,
        mut stack: ottavino::Stack<'gc, '_>,
    ) -> Result<SequencePoll<'gc>, ottavino::Error<'gc>> {
        // Snapshot the slot state (Copy), then release the borrow.
        let (state, env_raw) = PROMISE_SLOTS.with(|cell| {
            let v = cell.borrow();
            match v.get(self.slot) {
                Some(s) => (s.state, s.env_raw),
                None => (PromiseState::Rejected, ptr::null_mut()),
            }
        });

        match state {
            PromiseState::Pending => Ok(SequencePoll::Pending),
            PromiseState::Rejected => {
                let msg = ctx.intern(b"host promise rejected");
                Err(ottavino::Error::from_value(ottavino::Value::String(msg)))
            }
            PromiseState::Fulfilled(value_ref) => {
                let env = Env::from_raw(env_raw);
                let mut value = ptr::null_mut();
                unsafe {
                    sys::napi_get_reference_value(env_raw, value_ref, &mut value);
                    sys::napi_delete_reference(env_raw, value_ref);
                }
                let unknown = unsafe { Unknown::from_raw_unchecked(env_raw, value) };
                // The resolved value becomes the callback's return value.
                stack.clear();
                match js_to_ottavino_value(&env, ctx, &self.handles, unknown) {
                    Ok(v) => {
                        stack.push_back(v);
                        Ok(SequencePoll::Return)
                    }
                    Err(e) => {
                        let s = e.to_string();
                        let msg = ctx.intern(s.as_bytes());
                        Err(ottavino::Error::from_value(ottavino::Value::String(msg)))
                    }
                }
            }
        }
    }
}
