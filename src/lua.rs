use std::cell::RefCell;
use std::rc::Rc;

use napi::bindgen_prelude::{Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType};
use napi::sys::{napi_call_function, napi_create_reference, napi_get_reference_value};
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::Lua as OLua;

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// Globals handle for interacting with global variables (`_ENV` / `ctx.globals()`).
#[napi]
pub struct Globals {
    lua: Rc<RefCell<OLua>>,
}

#[napi]
impl Globals {
    /// Retrieves a global variable from the Lua environment.
    #[napi]
    pub fn get<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        let lua_ref = self.lua.clone();
        self.lua.borrow_mut().enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val, &lua_ref);
        });

        get_result
    }

    /// Binds a global variable in the Lua environment.
    /// Converts primitives, JS objects/arrays to Lua tables, and JS functions to callable Ottavino Callbacks.
    #[napi]
    pub fn set<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut set_result: Result<(), NapiError> = Ok(());
        let lua_ref = self.lua.clone();
        self.lua
            .borrow_mut()
            .enter(|ctx| match js_to_ottavino_value(env, ctx, value, &lua_ref) {
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

/// Thread wrapper for Lua coroutines.
#[napi]
pub struct LuaThread {
    lua: Rc<RefCell<OLua>>,
    thread: ottavino::StashedThread,
}

#[napi]
impl LuaThread {
    /// Mode of the thread ("stopped", "result", "normal", "suspended", "waiting", "running").
    #[napi]
    pub fn mode(&self) -> String {
        let mut mode_str = String::new();
        self.lua.borrow_mut().enter(|ctx| {
            let thread = ctx.fetch(&self.thread);
            mode_str = match thread.mode() {
                ottavino::ThreadMode::Stopped => "stopped",
                ottavino::ThreadMode::Result => "result",
                ottavino::ThreadMode::Normal => "normal",
                ottavino::ThreadMode::Suspended => "suspended",
                ottavino::ThreadMode::Waiting => "waiting",
                ottavino::ThreadMode::Running => "running",
            }
            .to_string();
        });
        mode_str
    }

    /// Reset thread to stopped state.
    #[napi]
    pub fn reset(&mut self) -> Result<(), NapiError> {
        let mut result = Ok(());
        self.lua.borrow_mut().enter(|ctx| {
            let thread = ctx.fetch(&self.thread);
            if let Err(e) = thread.reset(&ctx) {
                result = Err(NapiError::from_reason(e.to_string()));
            }
        });
        result
    }
}

/// Executor for step-by-step Lua execution with fuel control.
#[napi]
pub struct LuaExecutor {
    lua: Rc<RefCell<OLua>>,
    exec: ottavino::StashedExecutor,
}

#[napi]
impl LuaExecutor {
    /// Step the execution with a given amount of fuel.
    /// Returns true if execution is finished (done), false if more steps remain.
    #[napi]
    pub fn step(&mut self, fuel: f64) -> Result<bool, NapiError> {
        let mut result = Ok(false);
        self.lua.borrow_mut().enter(|ctx| {
            let exec = ctx.fetch(&self.exec);
            let mut fuel_obj = ottavino::Fuel::with(fuel as i32);
            match exec.step(ctx, &mut fuel_obj) {
                Ok(done) => result = Ok(done),
                Err(e) => result = Err(NapiError::from_reason(e.to_string())),
            }
        });
        result
    }

    /// Retrieve the final result of execution after completion.
    #[napi]
    pub fn take_result<'js>(&mut self, env: &'js Env) -> Result<Unknown<'js>, NapiError> {
        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        let lua_ref = self.lua.clone();
        self.lua.borrow_mut().enter(|ctx| {
            let exec = ctx.fetch(&self.exec);
            match exec.take_result::<ottavino::Value>(ctx) {
                Ok(Ok(val)) => {
                    eval_result = ottavino_value_to_js(env, ctx, val, &lua_ref);
                }
                Ok(Err(err)) => {
                    eval_result = Err(NapiError::from_reason(format!("Lua runtime error: {err}")));
                }
                Err(err) => {
                    eval_result = Err(NapiError::from_reason(format!(
                        "Lua execution error: {err}"
                    )));
                }
            }
        });

        eval_result
    }

    /// Stop/cancel execution.
    #[napi]
    pub fn stop(&mut self) {
        self.lua.borrow_mut().enter(|ctx| {
            let exec = ctx.fetch(&self.exec);
            exec.stop(&ctx);
        });
    }

    /// Current mode of the executor ("stopped", "result", "normal", "suspended", "running").
    #[napi]
    pub fn mode(&self) -> String {
        let mut mode_str = String::new();
        self.lua.borrow_mut().enter(|ctx| {
            let exec = ctx.fetch(&self.exec);
            mode_str = match exec.mode() {
                ottavino::ExecutorMode::Stopped => "stopped",
                ottavino::ExecutorMode::Result => "result",
                ottavino::ExecutorMode::Normal => "normal",
                ottavino::ExecutorMode::Suspended => "suspended",
                ottavino::ExecutorMode::Running => "running",
            }
            .to_string();
        });
        mode_str
    }
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
        let binding = self.inner.borrow();
        let m = binding.gc_metrics();
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

        let lua_ref = self.inner.clone();
        self.inner.borrow_mut().enter(
            |ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
                Ok(Ok(val)) => {
                    eval_result = ottavino_value_to_js(env, ctx, val, &lua_ref);
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

    /// Create a new Lua coroutine thread.
    #[napi]
    pub fn create_thread(&mut self) -> LuaThread {
        let mut stashed = None;
        self.inner.borrow_mut().enter(|ctx| {
            let thread = ottavino::Thread::new(ctx);
            stashed = Some(ctx.stash(thread));
        });
        LuaThread {
            lua: self.inner.clone(),
            thread: stashed.unwrap(),
        }
    }

    /// Create an Executor for driving step execution with fuel.
    #[napi]
    pub fn executor(&mut self, code: String) -> Result<LuaExecutor, NapiError> {
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.borrow_mut().enter(|ctx| {
            match ottavino::Closure::load(ctx, Some("executor"), code.as_bytes()) {
                Ok(closure) => {
                    let exec = ottavino::Executor::start(ctx, closure.into(), ());
                    stashed_opt = Some(ctx.stash(exec));
                }
                Err(err) => {
                    compile_err = Some(format!("Lua compile error: {err}"));
                }
            }
        });

        if let Some(err) = compile_err {
            return Err(NapiError::from_reason(err));
        }

        Ok(LuaExecutor {
            lua: self.inner.clone(),
            exec: stashed_opt.unwrap(),
        })
    }

    /// Returns the Globals handle for interacting with global variables.
    #[napi]
    pub fn globals(&mut self) -> Globals {
        Globals {
            lua: self.inner.clone(),
        }
    }
}

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
    val: ottavino::Value<'gc>,
    lua: &Rc<RefCell<OLua>>,
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
                    let js_elem = ottavino_value_to_js(env, ctx, elem, lua)?;
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
                    let js_val = ottavino_value_to_js(env, ctx, v, lua)?;
                    js_obj.set_named_property(&k_str, js_val)?;
                }
                js_obj.into_unknown(env)
            }
        }
        ottavino::Value::Thread(t) => {
            let stashed = ctx.stash(t);
            let lua_thread = LuaThread {
                lua: lua.clone(),
                thread: stashed,
            };
            lua_thread.into_unknown(env)
        }
        ottavino::Value::Function(_) => env.create_string("[lua function]")?.into_unknown(env),
        ottavino::Value::UserData(_) => env.create_string("[lua userdata]")?.into_unknown(env),
    }
}

fn js_to_ottavino_value<'gc>(
    env: &Env,
    ctx: ottavino::Context<'gc>,
    js_val: Unknown,
    lua: &Rc<RefCell<OLua>>,
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
            let mut ref_ptr = std::ptr::null_mut();
            let status = unsafe { napi_create_reference(raw_env, js_val.raw(), 1, &mut ref_ptr) };
            if status != napi::sys::Status::napi_ok {
                return Err(NapiError::from_reason("Failed to create reference for JS function"));
            }

            let lua_ref = lua.clone();
            let callback = ottavino::Callback::from_fn(&ctx, move |_ctx, _exec, mut stack| {
                let mut fn_val = std::ptr::null_mut();
                let status = unsafe { napi_get_reference_value(raw_env, ref_ptr, &mut fn_val) };
                if status != napi::sys::Status::napi_ok || fn_val.is_null() {
                    return Err(ottavino::Error::from_value(
                        ottavino::Value::String(_ctx.intern(b"Failed to get JS function reference")),
                    ));
                }

                let temp_env = Env::from_raw(raw_env);
                let mut js_args = Vec::with_capacity(stack.len());
                for val in stack.drain(..) {
                    match ottavino_value_to_js(&temp_env, _ctx, val, &lua_ref) {
                        Ok(js_val) => js_args.push(js_val.raw()),
                        Err(e) => {
                            return Err(ottavino::Error::from_value(
                                ottavino::Value::String(_ctx.intern(e.to_string().as_bytes())),
                            ));
                        }
                    }
                }

                let mut undefined_val = std::ptr::null_mut();
                unsafe { napi::sys::napi_get_undefined(raw_env, &mut undefined_val) };

                let mut result_val = std::ptr::null_mut();
                let call_status = unsafe {
                    napi_call_function(
                        raw_env,
                        undefined_val,
                        fn_val,
                        js_args.len(),
                        if js_args.is_empty() {
                            std::ptr::null()
                        } else {
                            js_args.as_ptr()
                        },
                        &mut result_val,
                    )
                };

                if call_status != napi::sys::Status::napi_ok {
                    let mut is_exception_pending = false;
                    unsafe { napi::sys::napi_is_exception_pending(raw_env, &mut is_exception_pending) };
                    if is_exception_pending {
                        let mut exception_val = std::ptr::null_mut();
                        unsafe { napi::sys::napi_get_and_clear_last_exception(raw_env, &mut exception_val) };
                        let js_err = unsafe { Unknown::from_raw_unchecked(raw_env, exception_val) };
                        if let Ok(s) = js_err.coerce_to_string() {
                            if let Ok(utf8) = s.into_utf8() {
                                if let Ok(str_val) = utf8.as_str() {
                                    return Err(ottavino::Error::from_value(
                                        ottavino::Value::String(_ctx.intern(str_val.as_bytes())),
                                    ));
                                }
                            }
                        }
                    }
                    return Err(ottavino::Error::from_value(
                        ottavino::Value::String(_ctx.intern(format!("JS call status error: {call_status:?}").as_bytes())),
                    ));
                }

                let js_res = unsafe { Unknown::from_raw_unchecked(raw_env, result_val) };
                let lua_val = match js_to_ottavino_value(&temp_env, _ctx, js_res, &lua_ref) {
                    Ok(v) => v,
                    Err(e) => {
                        return Err(ottavino::Error::from_value(
                            ottavino::Value::String(_ctx.intern(e.to_string().as_bytes())),
                        ));
                    }
                };

                stack.push_back(lua_val);
                Ok(ottavino::CallbackReturn::Return)
            });

            Ok(ottavino::Value::Function(ottavino::Function::Callback(callback)))
        }
        ValueType::Object => {
            if js_val.is_array()? {
                let js_arr = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let len = js_arr.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let elem: Unknown = js_arr.get_element(i)?;
                    let lua_elem = js_to_ottavino_value(env, ctx, elem, lua)?;
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
                    let lua_val = js_to_ottavino_value(env, ctx, prop_val, lua)?;
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
