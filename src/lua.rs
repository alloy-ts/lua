use napi::bindgen_prelude::{Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType};
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::{Callback, CallbackReturn, Lua as OLua, StashedExecutor, StashedThread};
use std::cell::RefCell;
use std::rc::Rc;

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// Result of stepping an executor.
#[napi(object)]
pub struct StepResult<'js> {
    /// True if the executor has completed execution or errored.
    pub done: bool,
    /// The return value if execution is complete, or undefined.
    pub value: Option<Unknown<'js>>,
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
#[napi]
pub struct Lua {
    inner: Rc<RefCell<OLua>>,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::full())),
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::empty())),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::core())),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::full())),
        }
    }

    /// Returns the Globals handle for interacting with global variables (`_ENV`).
    #[napi]
    pub fn globals(&mut self) -> Globals {
        Globals {
            lua: self.inner.clone(),
        }
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.borrow_mut().load_core();
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.borrow_mut().load_io();
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.borrow().total_memory() as f64
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.borrow_mut().gc_collect();
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let inner = self.inner.borrow();
        let m = inner.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.borrow_mut().enter(
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

        if let Err(e) = self.inner.borrow_mut().finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        self.inner.borrow_mut().enter(
            |ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
                Ok(Ok(val)) => {
                    eval_result = ottavino_value_to_js(env, ctx, val);
                }
                Ok(Err(err)) => {
                    eval_result = Err(NapiError::from_reason(format!("Lua runtime error: {err}")));
                }
                Err(err) => {
                    eval_result = Err(NapiError::from_reason(format!(
                        "Lua execution error: {err}"
                    )));
                }
            },
        );

        eval_result
    }

    /// Get a global variable from Lua environment by name (delegates to globals().get()).
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        self.globals().get(env, name)
    }

    /// Set a global variable in Lua environment by name (delegates to globals().set()).
    #[napi]
    pub fn set_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        self.globals().set(env, name, value)
    }

    /// Create a step-driven `LuaExecutor` for pacing execution with fuel limits.
    #[napi]
    pub fn executor(&mut self, code: String) -> Result<LuaExecutor, NapiError> {
        let mut stashed = None;
        let mut compile_err = None;

        self.inner.borrow_mut().enter(|ctx| {
            match ottavino::Closure::load(ctx, Some("executor"), code.as_bytes()) {
                Ok(closure) => {
                    let executor = ottavino::Executor::start(ctx, closure.into(), ());
                    stashed = Some(ctx.stash(executor));
                }
                Err(e) => {
                    compile_err = Some(e.to_string());
                }
            }
        });

        if let Some(e) = compile_err {
            return Err(NapiError::from_reason(format!("Lua compile error: {e}")));
        }

        Ok(LuaExecutor {
            lua: self.inner.clone(),
            stashed: stashed.unwrap(),
            is_done: false,
        })
    }

    /// Create a Lua thread (coroutine) handle.
    #[napi]
    pub fn create_thread(&mut self, code_or_fn_name: String) -> Result<LuaThread, NapiError> {
        let mut stashed_thread = None;
        let mut compile_err = None;

        self.inner.borrow_mut().enter(|ctx| {
            let func_opt = if code_or_fn_name.contains(' ')
                || code_or_fn_name.contains('=')
                || code_or_fn_name.contains("return")
            {
                match ottavino::Closure::load(ctx, Some("thread"), code_or_fn_name.as_bytes()) {
                    Ok(c) => Some(ottavino::Function::Closure(c)),
                    Err(e) => {
                        compile_err = Some(e.to_string());
                        None
                    }
                }
            } else {
                let key = ctx.intern(code_or_fn_name.as_bytes());
                let val = ctx.globals().get_raw(ottavino::Value::String(key));
                if let ottavino::Value::Function(f) = val {
                    Some(f)
                } else {
                    compile_err = Some(format!("Global '{code_or_fn_name}' is not a function"));
                    None
                }
            };

            if let Some(func) = func_opt {
                let thread = ottavino::Thread::new(ctx);
                let _ = thread.start_suspended(&ctx, func);
                stashed_thread = Some(ctx.stash(thread));
            }
        });

        if let Some(e) = compile_err {
            return Err(NapiError::from_reason(e));
        }

        Ok(LuaThread {
            lua: self.inner.clone(),
            stashed: stashed_thread.unwrap(),
        })
    }
}

/// Globals handle for interacting with global variables (`_ENV`).
#[napi]
pub struct Globals {
    lua: Rc<RefCell<OLua>>,
}

#[napi]
impl Globals {
    /// Retrieves a global variable from the Lua environment by name.
    #[napi]
    pub fn get<'js>(&mut self, env: &'js Env, name: String) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        self.lua.borrow_mut().enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val);
        });

        get_result
    }

    /// Binds a global variable in the Lua environment.
    /// Converts JS primitives, objects/arrays to Lua tables, and JS functions to Ottavino Callbacks.
    #[napi]
    pub fn set<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut set_result: Result<(), NapiError> = Ok(());
        self.lua
            .borrow_mut()
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
}

/// A step-driven VM executor wrapper.
#[napi]
pub struct LuaExecutor {
    lua: Rc<RefCell<OLua>>,
    stashed: StashedExecutor,
    is_done: bool,
}

#[napi]
impl LuaExecutor {
    /// Step execution with the given fuel amount.
    #[napi]
    pub fn step<'js>(
        &mut self,
        env: &'js Env,
        fuel_amount: i32,
    ) -> Result<StepResult<'js>, NapiError> {
        if self.is_done {
            return Ok(StepResult {
                done: true,
                value: None,
            });
        }

        let mut is_done = false;
        let mut ret_val = None;
        let mut step_err = None;

        self.lua.borrow_mut().enter(|ctx| {
            let executor = ctx.fetch(&self.stashed);
            let mut fuel = ottavino::Fuel::with(fuel_amount);
            let step_res = executor.step(ctx, &mut fuel);

            match step_res {
                Ok(is_finished) => {
                    if is_finished {
                        is_done = true;
                        match executor.take_result::<ottavino::Value>(ctx) {
                            Ok(Ok(val)) => match ottavino_value_to_js(env, ctx, val) {
                                Ok(js_val) => {
                                    ret_val = Some(js_val);
                                }
                                Err(e) => step_err = Some(e.to_string()),
                            },
                            Ok(Err(e)) => step_err = Some(e.to_string()),
                            Err(e) => step_err = Some(e.to_string()),
                        }
                    }
                }
                Err(e) => {
                    step_err = Some(e.to_string());
                }
            }
        });

        if let Some(e) = step_err {
            self.is_done = true;
            return Err(NapiError::from_reason(format!("Lua step error: {e}")));
        }

        self.is_done = is_done;

        Ok(StepResult {
            done: self.is_done,
            value: ret_val,
        })
    }

    /// Check if the executor has finished running.
    #[napi]
    pub fn is_done(&self) -> bool {
        self.is_done
    }
}

/// A wrapper around a Lua coroutine thread.
#[napi]
pub struct LuaThread {
    lua: Rc<RefCell<OLua>>,
    stashed: StashedThread,
}

#[napi]
impl LuaThread {
    /// Resume the thread coroutine with optional arguments.
    #[napi]
    pub fn resume<'js>(
        &mut self,
        env: &'js Env,
        args: Option<Vec<Unknown<'js>>>,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut result_opt = None;
        let mut resume_err = None;

        let stashed_exec = {
            let mut inner = self.lua.borrow_mut();
            let mut exec = None;

            inner.enter(|ctx| {
                let thread = ctx.fetch(&self.stashed);
                let mut lua_args = Vec::new();

                if let Some(args_vec) = args {
                    for arg in args_vec {
                        match js_to_ottavino_value(env, ctx, arg) {
                            Ok(v) => lua_args.push(v),
                            Err(e) => {
                                resume_err = Some(e.to_string());
                                return;
                            }
                        }
                    }
                }

                if let Err(e) = thread.resume(ctx, lua_args) {
                    resume_err = Some(format!("Failed to resume Lua thread: {e}"));
                    return;
                }

                match ottavino::Executor::run(&ctx, thread) {
                    Ok(executor) => {
                        exec = Some(ctx.stash(executor));
                    }
                    Err(e) => {
                        resume_err = Some(format!("Failed to run Lua executor for thread: {e}"));
                    }
                }
            });

            if let Some(e) = resume_err {
                return Err(NapiError::from_reason(e));
            }

            exec.unwrap()
        };

        {
            let mut inner = self.lua.borrow_mut();
            if let Err(e) = inner.finish(&stashed_exec) {
                return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
            }

            inner.enter(|ctx| {
                match ctx.fetch(&stashed_exec).take_result::<ottavino::Value>(ctx) {
                    Ok(Ok(val)) => match ottavino_value_to_js(env, ctx, val) {
                        Ok(js_val) => result_opt = Some(js_val),
                        Err(e) => resume_err = Some(e.to_string()),
                    },
                    Ok(Err(e)) => resume_err = Some(format!("Lua thread error: {e}")),
                    Err(e) => resume_err = Some(format!("Lua thread execution error: {e}")),
                }
            });
        }

        if let Some(e) = resume_err {
            return Err(NapiError::from_reason(e));
        }

        Ok(result_opt.unwrap_or_else(|| ().into_unknown(env).unwrap()))
    }

    /// Get current status of thread ("normal", "suspended", "running", "dead").
    #[napi]
    pub fn status(&mut self) -> String {
        let mut status_str = "dead".to_string();
        self.lua.borrow_mut().enter(|ctx| {
            let thread = ctx.fetch(&self.stashed);
            status_str = match thread.mode() {
                ottavino::ThreadMode::Normal => "normal",
                ottavino::ThreadMode::Suspended => "suspended",
                ottavino::ThreadMode::Running => "running",
                _ => "dead",
            }
            .to_string();
        });
        status_str
    }
}

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
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
                    let elem = t.get_value(ctx, i);
                    let js_elem = ottavino_value_to_js(env, ctx, elem)?;
                    js_arr.set_element((i - 1) as u32, js_elem)?;
                }
                js_arr.into_unknown(env)
            } else {
                let mut js_obj = Object::new(env)?;
                for (k, v) in t.iter() {
                    let k_str = match k {
                        ottavino::Value::String(s) => {
                            String::from_utf8_lossy(s.as_bytes()).to_string()
                        }
                        ottavino::Value::Integer(i) => i.to_string(),
                        ottavino::Value::Number(n) => n.to_string(),
                        _ => continue,
                    };
                    let js_val = ottavino_value_to_js(env, ctx, v)?;
                    js_obj.set_named_property(&k_str, js_val)?;
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
            let env_raw = env.raw();
            let fn_raw = js_val.raw();

            let mut js_ref = std::ptr::null_mut();
            let status = unsafe { napi::sys::napi_create_reference(env_raw, fn_raw, 1, &mut js_ref) };
            if status != napi::sys::Status::napi_ok {
                return Err(NapiError::from_reason("Failed to create reference for JS function"));
            }

            struct JsRefHolder {
                env_raw: napi::sys::napi_env,
                js_ref: napi::sys::napi_ref,
            }

            impl Drop for JsRefHolder {
                fn drop(&mut self) {
                    unsafe {
                        napi::sys::napi_delete_reference(self.env_raw, self.js_ref);
                    }
                }
            }

            let holder = Rc::new(JsRefHolder { env_raw, js_ref });

            let callback = Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let js_env = Env::from_raw(holder.env_raw);

                let mut fn_val = std::ptr::null_mut();
                let ref_status = unsafe {
                    napi::sys::napi_get_reference_value(holder.env_raw, holder.js_ref, &mut fn_val)
                };
                if ref_status != napi::sys::Status::napi_ok || fn_val.is_null() {
                    return Err(ottavino::Error::from_value(
                        ottavino::Value::String(ctx.intern(b"JS function reference expired")),
                    ));
                }

                let mut args = Vec::new();
                while !stack.is_empty() {
                    if let Some(val) = stack.pop_front() {
                        args.push(val);
                    }
                }

                let mut raw_this = std::ptr::null_mut();
                unsafe { napi::sys::napi_get_undefined(holder.env_raw, &mut raw_this); }

                let mut raw_args: Vec<napi::sys::napi_value> = Vec::new();
                for arg in args {
                    let js_arg = ottavino_value_to_js(&js_env, ctx, arg)?;
                    raw_args.push(js_arg.raw());
                }

                let mut raw_ret = std::ptr::null_mut();
                let status = unsafe {
                    napi::sys::napi_call_function(
                        holder.env_raw,
                        raw_this,
                        fn_val,
                        raw_args.len(),
                        if raw_args.is_empty() { std::ptr::null() } else { raw_args.as_mut_ptr() },
                        &mut raw_ret,
                    )
                };

                if status != napi::sys::Status::napi_ok {
                    let mut js_exc = std::ptr::null_mut();
                    let get_exc_status = unsafe {
                        napi::sys::napi_get_and_clear_last_exception(holder.env_raw, &mut js_exc)
                    };
                    if get_exc_status == napi::sys::Status::napi_ok && !js_exc.is_null() {
                        if let Ok(exc_val) = unsafe { Unknown::from_napi_value(holder.env_raw, js_exc) } {
                            // If it's an Error object with a message property, extract message or convert value
                            if let Ok(js_obj) = unsafe { Object::from_napi_value(holder.env_raw, js_exc) } {
                                if let Ok(msg) = js_obj.get_named_property::<String>("message") {
                                    return Err(ottavino::Error::from_value(
                                        ottavino::Value::String(ctx.intern(msg.as_bytes())),
                                    ));
                                }
                            }
                            if let Ok(lua_exc) = js_to_ottavino_value(&js_env, ctx, exc_val) {
                                return Err(ottavino::Error::from_value(lua_exc));
                            }
                        }
                    }

                    return Err(ottavino::Error::from_value(
                        ottavino::Value::String(ctx.intern(b"JS function call failed")),
                    ));
                }

                let ret = unsafe { Unknown::from_napi_value(holder.env_raw, raw_ret)? };
                let lua_ret = js_to_ottavino_value(&js_env, ctx, ret)?;

                stack.push_back(lua_ret);

                Ok(CallbackReturn::Return)
            });

            Ok(ottavino::Value::Function(callback.into()))
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
