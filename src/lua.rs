use napi::bindgen_prelude::{Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType};
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

    /// Register a JavaScript function as a global Lua callback.
    #[napi]
    pub fn register_callback(
        &mut self,
        env: &Env,
        name: String,
        callback: Unknown,
    ) -> Result<(), NapiError> {
        self.set_global(env, name, callback)
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
            let mut ref_ptr = std::ptr::null_mut();
            let status = unsafe {
                napi::sys::napi_create_reference(env.raw(), js_val.raw(), 1, &mut ref_ptr)
            };
            if status != 0 {
                return Err(NapiError::from_reason("Failed to create NAPI reference for function"));
            }

            let env_raw = env.raw();
            let cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let env = Env::from_raw(env_raw);
                let mut fn_raw = std::ptr::null_mut();
                let status = unsafe {
                    napi::sys::napi_get_reference_value(env_raw, ref_ptr, &mut fn_raw)
                };
                if status != 0 || fn_raw.is_null() {
                    let msg = ctx.intern(b"Failed to resolve JS function reference");
                    return Err(ottavino::Error::from_value(ottavino::Value::String(msg)));
                }

                let len = stack.len();
                let mut raw_args = Vec::with_capacity(len);
                for i in 0..len {
                    let val = stack.get(i);
                    let js_val = ottavino_value_to_js(&env, ctx, val).map_err(|e| {
                        let msg = ctx.intern(e.to_string().as_bytes());
                        ottavino::Error::from_value(ottavino::Value::String(msg))
                    })?;
                    raw_args.push(js_val.raw());
                }

                let mut global_raw = std::ptr::null_mut();
                unsafe { napi::sys::napi_get_global(env_raw, &mut global_raw) };

                let mut result_raw = std::ptr::null_mut();
                let call_status = unsafe {
                    napi::sys::napi_call_function(
                        env_raw,
                        global_raw,
                        fn_raw,
                        raw_args.len(),
                        raw_args.as_ptr(),
                        &mut result_raw,
                    )
                };

                if call_status != 0 || result_raw.is_null() {
                    let msg = ctx.intern(b"Error executing JS callback from Lua");
                    return Err(ottavino::Error::from_value(ottavino::Value::String(msg)));
                }

                let ret_unknown = unsafe { Unknown::from_raw_unchecked(env_raw, result_raw) };

                let lua_ret = js_to_ottavino_value(&env, ctx, ret_unknown).map_err(|e| {
                    let msg = ctx.intern(e.to_string().as_bytes());
                    ottavino::Error::from_value(ottavino::Value::String(msg))
                })?;

                stack.replace(ctx, lua_ret);
                Ok(ottavino::CallbackReturn::Return)
            });
            Ok(ottavino::Value::Function(ottavino::Function::Callback(cb)))
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
