use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::{
    Env, FromNapiValue, Function as NapiFunction, JsObjectValue, Object, ToNapiValue, ValueType,
};
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

/// A handle for interacting with global variables in the Lua environment (`_ENV` / `ctx.globals()`).
#[napi]
pub struct Globals {
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Globals {
    /// Get a global variable from the Lua environment by name.
    #[napi]
    pub fn get<'js>(&self, env: &'js Env, name: String) -> Result<Unknown<'js>, NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        lua.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val);
        });

        get_result
    }

    /// Set/bind a global variable in the Lua environment by name.
    /// Automatically converts primitives, objects, arrays, and JS functions into Lua types.
    #[napi]
    pub fn set<'js>(
        &self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        let mut set_result: Result<(), NapiError> = Ok(());
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
}

/// An execution handle for stepping and polling Lua execution.
#[napi]
pub struct Executor {
    stashed: ottavino::StashedExecutor,
    is_done: bool,
}

#[napi]
impl Executor {
    /// Step the execution by consuming up to `fuel` units.
    /// Returns `true` if execution is complete, or `false` if more fuel is needed.
    #[napi]
    pub fn step(&mut self, lua: &mut Lua, fuel: f64) -> Result<bool, NapiError> {
        if self.is_done {
            return Ok(true);
        }

        let mut f = ottavino::Fuel::with(fuel as i32);
        let mut lua_guard = lua
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        let finished = lua_guard
            .enter(|ctx| ctx.fetch(&self.stashed).step(ctx, &mut f))
            .map_err(|e| NapiError::from_reason(format!("Lua step error: {e}")))?;

        if finished {
            self.is_done = true;
        }

        Ok(finished)
    }

    /// Retrieve the execution result as a JavaScript value once `step()` returns `true`.
    #[napi]
    pub fn take_result<'js>(
        &mut self,
        env: &'js Env,
        lua: &mut Lua,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Result already taken or execution not complete"));

        let mut lua_guard = lua
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        lua_guard.enter(|ctx| {
            match ctx.fetch(&self.stashed).take_result::<ottavino::Value>(ctx) {
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
            }
        });

        eval_result
    }
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
#[napi]
pub struct Lua {
    pub(crate) inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::full())),
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::empty())),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::core())),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::full())),
        }
    }

    /// Returns the `Globals` handle for interacting with global variables (`_ENV` / `ctx.globals()`).
    #[napi]
    pub fn globals(&self) -> Globals {
        Globals {
            inner: self.inner.clone(),
        }
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) -> Result<(), NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        lua.load_core();
        Ok(())
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) -> Result<(), NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        lua.load_io();
        Ok(())
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> Result<f64, NapiError> {
        let lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        Ok(lua.total_memory() as f64)
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) -> Result<(), NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        lua.gc_collect();
        Ok(())
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> Result<GcMetrics, NapiError> {
        let lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        let m = lua.gc_metrics();
        Ok(GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        })
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        let mut stashed_opt = None;
        let mut compile_err = None;

        lua.enter(|ctx| {
            match ottavino::Closure::load(ctx, Some("eval"), code.as_bytes()) {
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

        let stashed = stashed_opt.unwrap();

        if let Err(e) = lua.finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua execution error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        lua.enter(|ctx| {
            match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
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
            }
        });

        eval_result
    }

    /// Create an `Executor` handle to step through Lua script execution with fuel budgets.
    #[napi]
    pub fn executor(&mut self, code: String) -> Result<Executor, NapiError> {
        let mut lua = self
            .inner
            .lock()
            .map_err(|e| NapiError::from_reason(e.to_string()))?;

        let mut stashed_opt = None;
        let mut compile_err = None;

        lua.enter(|ctx| {
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

        Ok(Executor {
            stashed: stashed_opt.unwrap(),
            is_done: false,
        })
    }

    /// Convenience alias for `globals().get(name)`.
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        self.globals().get(env, name)
    }

    /// Convenience alias for `globals().set(name, value)`.
    #[napi]
    pub fn set_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        self.globals().set(env, name, value)
    }

    /// Convenience alias for `globals().set(name, callback)`.
    #[napi]
    pub fn register_callback<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        callback: NapiFunction<'js>,
    ) -> Result<(), NapiError> {
        let val = unsafe { Unknown::from_napi_value(env.raw(), callback.raw())? };
        self.globals().set(env, name, val)
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
                let mut is_pure_array = true;
                let mut count = 0;
                for (k, _) in t.iter() {
                    count += 1;
                    match k {
                        ottavino::Value::Integer(i) if i >= 1 && i <= len => {}
                        _ => {
                            is_pure_array = false;
                            break;
                        }
                    }
                }
                if is_pure_array && count as i64 == len {
                    let mut js_arr = env.create_array(len as u32)?;
                    for i in 1..=len {
                        let elem = t.get_value(ctx, i);
                        let js_elem = ottavino_value_to_js(env, ctx, elem)?;
                        js_arr.set_element((i - 1) as u32, js_elem)?;
                    }
                    return js_arr.into_unknown(env);
                }
            }

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
            let mut raw_ref = std::ptr::null_mut();
            unsafe {
                napi::sys::napi_create_reference(env.raw(), js_val.raw(), 1, &mut raw_ref);
            }
            #[allow(dead_code)]
            struct SafeRef(napi::sys::napi_ref);
            unsafe impl Send for SafeRef {}
            unsafe impl Sync for SafeRef {}
            let safe_ref = Arc::new(SafeRef(raw_ref));

            let env_raw = env.raw();
            let cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let mut raw_fn = std::ptr::null_mut();
                unsafe {
                    napi::sys::napi_get_reference_value(env_raw, safe_ref.0, &mut raw_fn);
                }
                if raw_fn.is_null() {
                    stack.clear();
                    return Ok(ottavino::CallbackReturn::Return);
                }

                let len = stack.len();
                let mut js_args = Vec::with_capacity(len);
                for i in 0..len {
                    let arg_val = stack.get(i);
                    let env_ref = Env::from_raw(env_raw);
                    if let Ok(js_arg) = ottavino_value_to_js(&env_ref, ctx, arg_val) {
                        js_args.push(js_arg.raw());
                    }
                }

                let mut raw_undefined = std::ptr::null_mut();
                unsafe {
                    napi::sys::napi_get_undefined(env_raw, &mut raw_undefined);
                }

                let mut js_result = std::ptr::null_mut();
                let status = unsafe {
                    napi::sys::napi_call_function(
                        env_raw,
                        raw_undefined,
                        raw_fn,
                        js_args.len(),
                        js_args.as_ptr(),
                        &mut js_result,
                    )
                };

                if status != napi::sys::Status::napi_ok {
                    let mut is_exception = false;
                    unsafe {
                        napi::sys::napi_is_exception_pending(env_raw, &mut is_exception);
                    }
                    let err_msg = if is_exception {
                        let mut exception_val = std::ptr::null_mut();
                        unsafe {
                            napi::sys::napi_get_and_clear_last_exception(
                                env_raw,
                                &mut exception_val,
                            );
                        }
                        let _env_ref = Env::from_raw(env_raw);
                        let unk = unsafe { Unknown::from_raw_unchecked(env_raw, exception_val) };
                        if let Ok(str_val) = unk.coerce_to_string() {
                            if let Ok(s) = str_val.into_utf8() {
                                if let Ok(msg) = s.as_str() {
                                    format!("JavaScript error in callback: {msg}")
                                } else {
                                    "JavaScript error in callback".to_string()
                                }
                            } else {
                                "JavaScript error in callback".to_string()
                            }
                        } else {
                            "JavaScript error in callback".to_string()
                        }
                    } else {
                        "JavaScript callback execution error".to_string()
                    };

                    stack.clear();
                    return Err(ottavino::Error::Runtime(ottavino::RuntimeError::new(
                        std::io::Error::other(err_msg),
                    )));
                }

                stack.clear();

                if !js_result.is_null() {
                    let env_ref = Env::from_raw(env_raw);
                    let unk = unsafe { Unknown::from_raw_unchecked(env_raw, js_result) };
                    if let Ok(lua_ret) = js_to_ottavino_value(&env_ref, ctx, unk) {
                        stack.push_back(lua_ret);
                    }
                }

                Ok(ottavino::CallbackReturn::Return)
            });
            Ok(ottavino::Value::Function(cb.into()))
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
