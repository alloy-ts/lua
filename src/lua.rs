use napi::bindgen_prelude::{
    Env, FromNapiValue, Function, JsObjectValue, Object, ToNapiValue, ValueType,
};
use napi::{sys, Error as NapiError, JsValue, Unknown};
use napi_derive::napi;
use std::ptr;

use ottavino::Lua as OLua;

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// A handle to a stashed step-by-step Lua executor.
#[napi]
pub struct LuaExecutor {
    stashed: ottavino::StashedExecutor,
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
#[napi]
pub struct Lua {
    inner: OLua,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: OLua::full(),
        }
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: OLua::empty(),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: OLua::core(),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: OLua::full(),
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
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.enter(
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

        if let Err(e) = self.inner.finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        self.inner.enter(
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

    /// Create a step-by-step executor for Lua code.
    #[napi]
    pub fn create_executor(&mut self, code: String) -> Result<LuaExecutor, NapiError> {
        let mut stashed_opt = None;
        let mut compile_err = None;

        self.inner.enter(
            |ctx| match ottavino::Closure::load(ctx, Some("executor"), code.as_bytes()) {
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

        Ok(LuaExecutor {
            stashed: stashed_opt.unwrap(),
        })
    }

    /// Step a LuaExecutor with a specified fuel budget.
    #[napi]
    pub fn step_executor<'js>(
        &mut self,
        env: &'js Env,
        executor: &LuaExecutor,
        fuel_amount: i32,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut fuel = ottavino::Fuel::with(fuel_amount);
        let mut done = false;
        let mut step_err = None;

        self.inner.enter(|ctx| {
            match ctx.fetch(&executor.stashed).step(ctx, &mut fuel) {
                Ok(is_done) => {
                    done = is_done;
                }
                Err(err) => {
                    step_err = Some(format!("Lua execution error: {err}"));
                }
            }
        });

        if let Some(err) = step_err {
            return Err(NapiError::from_reason(err));
        }

        let mut res_obj = Object::new(env)?;
        res_obj.set_named_property("done", done)?;

        if done {
            let mut final_val = ().into_unknown(env)?;
            self.inner.enter(|ctx| {
                if let Ok(Ok(val)) = ctx.fetch(&executor.stashed).take_result::<ottavino::Value>(ctx) {
                    if let Ok(js_val) = ottavino_value_to_js(env, ctx, val) {
                        final_val = js_val;
                    }
                }
            });
            res_obj.set_named_property("value", final_val)?;
        } else {
            res_obj.set_named_property("value", ().into_unknown(env)?)?;
        }

        res_obj.into_unknown(env)
    }

    /// Get a global variable from Lua environment by name.
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        self.inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val);
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

    /// Register a JS function in global scope as a callable Lua callback.
    #[napi]
    pub fn register_callback(
        &mut self,
        env: &Env,
        name: String,
        callback: Function<(), ()>,
    ) -> Result<(), NapiError> {
        let func_ref = callback.create_ref()?;
        let env_raw = env.raw();

        let mut reg_result = Ok(());
        self.inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let lua_cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let current_env = Env::from_raw(env_raw);
                if let Ok(js_fn) = func_ref.borrow_back(&current_env) {
                    let mut raw_args = Vec::new();
                    for val in stack.drain(..) {
                        if let Ok(js_val) = ottavino_value_to_js(&current_env, ctx, val) {
                            raw_args.push(js_val.raw());
                        }
                    }

                    let mut global_recv = ptr::null_mut();
                    let mut ret_val_raw = ptr::null_mut();
                    unsafe {
                        sys::napi_get_global(env_raw, &mut global_recv);
                        let status = sys::napi_call_function(
                            env_raw,
                            global_recv,
                            js_fn.raw(),
                            raw_args.len(),
                            raw_args.as_ptr(),
                            &mut ret_val_raw,
                        );
                        if status == sys::Status::napi_ok && !ret_val_raw.is_null() {
                            let ret_unknown = Unknown::from_raw_unchecked(env_raw, ret_val_raw);
                            if let Ok(lua_val) = js_to_ottavino_value(&current_env, ctx, ret_unknown) {
                                stack.push_back(lua_val);
                            }
                        }
                    }
                }
                Ok(ottavino::CallbackReturn::Return)
            });
            if let Err(e) = ctx.globals().set(ctx, key, lua_cb) {
                reg_result = Err(NapiError::from_reason(e.to_string()));
            }
        });

        reg_result
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
