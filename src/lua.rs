use napi::bindgen_prelude::{
    Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType,
};
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::{Lua as OLua, StashedExecutor, StashedThread};
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

/// Result of a single step execution on an `Executor`.
#[napi(object)]
pub struct StepResult {
    /// Whether execution has completed.
    pub done: bool,
    /// Fuel remaining after this step.
    pub fuel_remaining: i32,
    /// Execution result value if done and successful.
    pub value: Option<Unknown<'static>>,
    /// Error message if execution encountered a runtime error.
    pub error: Option<String>,
}

/// RAII wrapper for NAPI callback reference deletion.
struct NapiRefWrapper {
    env_raw: *mut napi::sys::napi_env__,
    ref_ptr: napi::sys::napi_ref,
}

impl Drop for NapiRefWrapper {
    fn drop(&mut self) {
        if !self.env_raw.is_null() && !self.ref_ptr.is_null() {
            unsafe {
                napi::sys::napi_delete_reference(self.env_raw, self.ref_ptr);
            }
        }
    }
}

/// An Executor instance for incremental step execution.
#[napi]
pub struct Executor {
    lua: Rc<RefCell<OLua>>,
    active_env: Rc<RefCell<Option<*mut napi::sys::napi_env__>>>,
    stashed_exec: StashedExecutor,
    done: bool,
}

#[napi]
impl Executor {
    /// Step execution with the specified amount of fuel.
    #[napi]
    pub fn step<'js>(&mut self, env: &'js Env, fuel_amount: i32) -> Result<StepResult, NapiError> {
        if self.done {
            return Ok(StepResult {
                done: true,
                fuel_remaining: fuel_amount,
                value: None,
                error: None,
            });
        }

        *self.active_env.borrow_mut() = Some(env.raw());

        let res = (|| {
            let mut fuel = ottavino::Fuel::with(fuel_amount);
            let mut lua = self.lua.borrow_mut();
            let mut is_done = false;
            let mut step_err = None;

            lua.enter(|ctx| {
                let exec = ctx.fetch(&self.stashed_exec);
                match exec.step(ctx, &mut fuel) {
                    Ok(done) => {
                        is_done = done;
                    }
                    Err(err) => {
                        step_err = Some(format!("Lua runtime error: {err}"));
                    }
                }
            });

            let fuel_remaining = fuel.remaining();

            if let Some(err) = step_err {
                self.done = true;
                return Ok(StepResult {
                    done: true,
                    fuel_remaining,
                    value: None,
                    error: Some(err),
                });
            }

            if is_done {
                self.done = true;
                let mut eval_result: Option<Unknown<'js>> = None;
                let mut take_err = None;

                lua.enter(|ctx| {
                    let exec = ctx.fetch(&self.stashed_exec);
                    match exec.take_result::<ottavino::Value>(ctx) {
                        Ok(Ok(val)) => {
                            match ottavino_value_to_js(env, ctx, val, &self.lua, &self.active_env) {
                                Ok(js_val) => eval_result = Some(js_val),
                                Err(e) => take_err = Some(e.to_string()),
                            }
                        }
                        Ok(Err(err)) => take_err = Some(format!("Lua runtime error: {err}")),
                        Err(err) => take_err = Some(format!("Lua execution error: {err}")),
                    }
                });

                if let Some(err) = take_err {
                    Ok(StepResult {
                        done: true,
                        fuel_remaining,
                        value: None,
                        error: Some(err),
                    })
                } else {
                    let static_val = unsafe {
                        std::mem::transmute::<Option<Unknown<'js>>, Option<Unknown<'static>>>(eval_result)
                    };
                    Ok(StepResult {
                        done: true,
                        fuel_remaining,
                        value: static_val,
                        error: None,
                    })
                }
            } else {
                Ok(StepResult {
                    done: false,
                    fuel_remaining,
                    value: None,
                    error: None,
                })
            }
        })();

        *self.active_env.borrow_mut() = None;
        res
    }

    /// Check if the executor has completed.
    #[napi(getter)]
    pub fn is_done(&self) -> bool {
        self.done
    }
}

/// A Lua Thread / Coroutine exported to JS.
#[napi]
pub struct Thread {
    lua: Rc<RefCell<OLua>>,
    active_env: Rc<RefCell<Option<*mut napi::sys::napi_env__>>>,
    stashed_thread: StashedThread,
}

#[napi]
impl Thread {
    /// Get thread status ("normal", "running", "suspended", "stopped", "result", or "waiting").
    #[napi]
    pub fn status(&self) -> String {
        let mut lua = self.lua.borrow_mut();
        let mut status_str = "stopped".to_string();
        lua.enter(|ctx| {
            let thread = ctx.fetch(&self.stashed_thread);
            status_str = match thread.mode() {
                ottavino::ThreadMode::Normal => "normal",
                ottavino::ThreadMode::Running => "running",
                ottavino::ThreadMode::Suspended => "suspended",
                ottavino::ThreadMode::Stopped => "stopped",
                ottavino::ThreadMode::Result => "result",
                ottavino::ThreadMode::Waiting => "waiting",
            }
            .to_string();
        });
        status_str
    }

    /// Resume the thread and return its yielded/return value.
    #[napi]
    pub fn resume<'js>(&mut self, env: &'js Env) -> Result<Unknown<'js>, NapiError> {
        *self.active_env.borrow_mut() = Some(env.raw());

        let res = (|| {
            let mut eval_result = None;
            let mut eval_err = None;

            self.lua.borrow_mut().enter(|ctx| {
                let thread = ctx.fetch(&self.stashed_thread);
                let cb = ottavino::Callback::from_fn_with(&ctx, thread, move |thread, _ctx, _exec, _stack| {
                    Ok(ottavino::CallbackReturn::Resume {
                        thread: *thread,
                        then: None,
                    })
                });
                let exec = ottavino::Executor::start(ctx, cb.into(), ());
                let stashed_exec = ctx.stash(exec);
                let mut fuel = ottavino::Fuel::with(i32::MAX);
                let exec_ref = ctx.fetch(&stashed_exec);
                match exec_ref.step(ctx, &mut fuel) {
                    Ok(_) => match exec_ref.take_result::<ottavino::Value>(ctx) {
                        Ok(Ok(val)) => match ottavino_value_to_js(env, ctx, val, &self.lua, &self.active_env) {
                            Ok(js_val) => eval_result = Some(js_val),
                            Err(e) => eval_err = Some(e.to_string()),
                        },
                        Ok(Err(err)) => eval_err = Some(format!("Lua runtime error: {err}")),
                        Err(err) => eval_err = Some(format!("Lua execution error: {err}")),
                    },
                    Err(err) => eval_err = Some(format!("Lua runtime error: {err}")),
                }
            });

            if let Some(err) = eval_err {
                return Err(NapiError::from_reason(err));
            }

            Ok(eval_result.unwrap_or_else(|| ().into_unknown(env).unwrap()))
        })();

        *self.active_env.borrow_mut() = None;
        res
    }
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
#[napi]
pub struct Lua {
    inner: Rc<RefCell<OLua>>,
    active_env: Rc<RefCell<Option<*mut napi::sys::napi_env__>>>,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        let mut inner = OLua::full();
        inner.load_io();
        Lua {
            inner: Rc::new(RefCell::new(inner)),
            active_env: Rc::new(RefCell::new(None)),
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::empty())),
            active_env: Rc::new(RefCell::new(None)),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: Rc::new(RefCell::new(OLua::core())),
            active_env: Rc::new(RefCell::new(None)),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        let mut inner = OLua::full();
        inner.load_io();
        Lua {
            inner: Rc::new(RefCell::new(inner)),
            active_env: Rc::new(RefCell::new(None)),
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
        let lua = self.inner.borrow();
        let m = lua.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Create an `Executor` for step-driven execution of Lua code.
    #[napi]
    pub fn executor(&mut self, code: String) -> Result<Executor, NapiError> {
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.borrow_mut().enter(|ctx| {
            match ottavino::Closure::load(ctx, Some("executor"), code.as_bytes()) {
                Ok(closure) => {
                    let executor = ottavino::Executor::start(ctx, closure.into(), ());
                    stashed_opt = Some(ctx.stash(executor));
                }
                Err(err) => {
                    compile_err = Some(format!("Lua compile error: {err}"));
                }
            }
        });

        if let Some(err) = compile_err {
            return Err(NapiError::from_reason(err));
        }

        let stashed_exec = stashed_opt.unwrap();
        Ok(Executor {
            lua: Rc::clone(&self.inner),
            active_env: Rc::clone(&self.active_env),
            stashed_exec,
            done: false,
        })
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let mut executor = self.executor(code)?;
        let step_res = executor.step(env, i32::MAX)?;

        if let Some(err) = step_res.error {
            return Err(NapiError::from_reason(err));
        }

        Ok(step_res
            .value
            .unwrap_or_else(|| ().into_unknown(env).unwrap()))
    }

    /// Get a global variable from Lua environment by name.
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        let mut lua = self.inner.borrow_mut();
        lua.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val, &self.inner, &self.active_env);
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
        let mut lua = self.inner.borrow_mut();
        lua.enter(|ctx| match js_to_ottavino_value(env, ctx, value) {
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

    /// Register a JavaScript function as a Lua callback in global scope.
    #[napi]
    pub fn register_callback<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        callback: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let active_env_ptr = Rc::clone(&self.active_env);
        let mut ref_ptr = std::ptr::null_mut();
        let status = unsafe {
            napi::sys::napi_create_reference(env.raw(), callback.raw(), 1, &mut ref_ptr)
        };
        if status != napi::sys::Status::napi_ok {
            return Err(NapiError::from_reason("Failed to create reference for callback"));
        }

        let ref_wrapper = Rc::new(NapiRefWrapper {
            env_raw: env.raw(),
            ref_ptr,
        });

        let mut lua = self.inner.borrow_mut();
        let inner_lua = Rc::clone(&self.inner);
        let inner_active_env = Rc::clone(&self.active_env);

        lua.enter(|ctx| {
            let cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let env_raw = match *active_env_ptr.borrow() {
                    Some(raw) => raw,
                    None => {
                        let err_str = ctx.intern(b"No active JS environment for callback execution");
                        return Err(ottavino::Error::from_value(ottavino::Value::String(err_str)));
                    }
                };
                let env = Env::from_raw(env_raw);

                let mut js_fn_val = std::ptr::null_mut();
                let status = unsafe {
                    napi::sys::napi_get_reference_value(env_raw, ref_wrapper.ref_ptr, &mut js_fn_val)
                };
                if status != napi::sys::Status::napi_ok || js_fn_val.is_null() {
                    let err_str = ctx.intern(b"Failed to resolve JS function reference");
                    return Err(ottavino::Error::from_value(ottavino::Value::String(err_str)));
                }

                let mut js_args = Vec::with_capacity(stack.len());
                for i in 0..stack.len() {
                    let val = stack.get(i);
                    match ottavino_value_to_js(&env, ctx, val, &inner_lua, &inner_active_env) {
                        Ok(js_val) => js_args.push(js_val),
                        Err(e) => {
                            let err_str = ctx.intern(e.to_string().as_bytes());
                            return Err(ottavino::Error::from_value(ottavino::Value::String(err_str)));
                        }
                    }
                }

                let call_res: Result<Unknown, NapiError> = {
                    let mut args_raw = Vec::with_capacity(js_args.len());
                    for a in &js_args {
                        args_raw.push(a.raw());
                    }
                    let mut return_val = std::ptr::null_mut();
                    let mut undefined_val = std::ptr::null_mut();
                    unsafe {
                        napi::sys::napi_get_undefined(env_raw, &mut undefined_val);
                    }
                    let status = unsafe {
                        napi::sys::napi_call_function(
                            env_raw,
                            undefined_val,
                            js_fn_val,
                            args_raw.len(),
                            args_raw.as_ptr(),
                            &mut return_val,
                        )
                    };
                    if status == napi::sys::Status::napi_ok {
                        unsafe { Unknown::from_napi_value(env_raw, return_val) }
                    } else {
                        Err(NapiError::from_reason("JS function call failed"))
                    }
                };
                match call_res {
                    Ok(js_ret) => match js_to_ottavino_value(&env, ctx, js_ret) {
                        Ok(lua_ret) => {
                            stack.replace(ctx, lua_ret);
                            Ok(ottavino::CallbackReturn::Return)
                        }
                        Err(e) => {
                            let err_str = ctx.intern(e.to_string().as_bytes());
                            Err(ottavino::Error::from_value(ottavino::Value::String(err_str)))
                        }
                    },
                    Err(e) => {
                        let err_str = ctx.intern(e.to_string().as_bytes());
                        Err(ottavino::Error::from_value(ottavino::Value::String(err_str)))
                    }
                }
            });
            let name_key = ctx.intern(name.as_bytes());
            let _ = ctx.globals().set(ctx, name_key, cb);
        });

        Ok(())
    }
}

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
    val: ottavino::Value<'gc>,
    lua: &Rc<RefCell<OLua>>,
    active_env: &Rc<RefCell<Option<*mut napi::sys::napi_env__>>>,
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
                    let js_elem = ottavino_value_to_js(env, ctx, elem, lua, active_env)?;
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
                    let js_val = ottavino_value_to_js(env, ctx, v, lua, active_env)?;
                    js_obj.set_named_property(&k_str, js_val)?;
                }
                js_obj.into_unknown(env)
            }
        }
        ottavino::Value::Function(_) => env.create_string("[lua function]")?.into_unknown(env),
        ottavino::Value::Thread(t) => {
            let stashed_thread = ctx.stash(t);
            let thread_obj = Thread {
                lua: Rc::clone(lua),
                active_env: Rc::clone(active_env),
                stashed_thread,
            };
            thread_obj.into_unknown(env)
        }
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
