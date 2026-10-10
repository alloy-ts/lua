use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::{
    Env, FromNapiValue, Function as JsFunction, FunctionRef, JsObjectValue, Object, ToNapiValue,
    ValueType,
};
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;
use ottavino_gc_arena::{Collect, Collection};

use ottavino::Lua as OLua;

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// Global variable handle for interacting with Lua globals (`_ENV`).
#[napi]
pub struct Globals {
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Globals {
    #[napi(constructor)]
    pub fn new() -> Self {
        Globals {
            inner: Arc::new(Mutex::new(OLua::full())),
        }
    }

    /// Get a global variable from the Lua environment by name.
    #[napi]
    pub fn get<'js>(
        &self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, val);
        });

        get_result
    }

    /// Set a global variable in the Lua environment by name.
    #[napi]
    pub fn set<'js>(
        &self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        let mut set_result: Result<(), NapiError> = Ok(());
        inner.enter(|ctx| match js_to_ottavino_value(env, ctx, value) {
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

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
#[napi]
pub struct Lua {
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Lua {
    /// Returns the `Globals` handle for interacting with global variables (`_ENV`).
    #[napi]
    pub fn globals(&self) -> Globals {
        Globals {
            inner: Arc::clone(&self.inner),
        }
    }

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

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&self) -> Result<(), NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        inner.load_core();
        Ok(())
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&self) -> Result<(), NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        inner.load_io();
        Ok(())
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> Result<f64, NapiError> {
        let inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        Ok(inner.total_memory() as f64)
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&self) -> Result<(), NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        inner.gc_collect();
        Ok(())
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> Result<GcMetrics, NapiError> {
        let inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };
        let m = inner.gc_metrics();
        Ok(GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        })
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    #[napi]
    pub fn eval<'js>(&self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(e) => return Err(NapiError::from_reason(format!("Mutex lock error: {e}"))),
        };

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

        inner.enter(
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
        &self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        self.globals().get(env, name)
    }

    /// Set a global variable in Lua environment by name.
    #[napi]
    pub fn set_global<'js>(
        &self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        self.globals().set(env, name, value)
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
            let js_fn = unsafe { JsFunction::from_napi_value(env.raw(), js_val.raw())? };
            let fn_ref = js_fn.create_ref()?;

            struct JsCallbackRoot {
                fn_ref: FunctionRef<Unknown<'static>, Unknown<'static>>,
            }

            unsafe impl Collect for JsCallbackRoot {
                fn needs_trace() -> bool {
                    false
                }
                fn trace(&self, _cc: &Collection) {}
            }

            let raw_env = env.raw();
            let cb = ottavino::Callback::from_fn_with(
                &ctx,
                JsCallbackRoot { fn_ref },
                move |root, ctx, _exec, mut stack| {
                    let env = Env::from_raw(raw_env);
                    let js_fn = match root.fn_ref.borrow_back(&env) {
                        Ok(f) => f,
                        Err(e) => return Err(ottavino::Error::from(anyhow::Error::msg(e.to_string()))),
                    };

                    let stack_len = stack.len();
                    let mut js_args = Vec::with_capacity(stack_len);
                    for i in 0..stack_len {
                        let lua_val = stack.get(i);
                        let js_arg = match ottavino_value_to_js(&env, ctx, lua_val) {
                            Ok(arg) => arg,
                            Err(e) => return Err(ottavino::Error::from(anyhow::Error::msg(e.to_string()))),
                        };
                        js_args.push(js_arg);
                    }

                    let mut raw_args: Vec<napi::sys::napi_value> = js_args.iter().map(|v| v.raw()).collect();
                    let mut undefined_raw = std::ptr::null_mut();
                    let mut result_raw = std::ptr::null_mut();
                    let js_res: Unknown = unsafe {
                        napi::sys::napi_get_undefined(env.raw(), &mut undefined_raw);
                        let status = napi::sys::napi_call_function(
                            env.raw(),
                            undefined_raw,
                            js_fn.raw(),
                            raw_args.len(),
                            raw_args.as_mut_ptr(),
                            &mut result_raw,
                        );
                        if status != napi::sys::Status::napi_ok {
                            let mut err_val = std::ptr::null_mut();
                            napi::sys::napi_get_and_clear_last_exception(env.raw(), &mut err_val);
                            let err_msg = if !err_val.is_null() {
                                if let Ok(js_err) = Unknown::from_napi_value(env.raw(), err_val) {
                                    if let Ok(js_obj) = Object::from_napi_value(env.raw(), js_err.raw()) {
                                        if let Ok(msg) = js_obj.get_named_property::<String>("message") {
                                            msg
                                        } else if let Ok(s) = js_err.coerce_to_string() {
                                            if let Ok(u) = s.into_utf8() {
                                                u.as_str().map(|str| str.to_string()).unwrap_or_else(|_| "JS callback failed".to_string())
                                            } else {
                                                "JS callback failed".to_string()
                                            }
                                        } else {
                                            "JS callback failed".to_string()
                                        }
                                    } else if let Ok(s) = js_err.coerce_to_string() {
                                        if let Ok(u) = s.into_utf8() {
                                            u.as_str().map(|str| str.to_string()).unwrap_or_else(|_| "JS callback failed".to_string())
                                        } else {
                                            "JS callback failed".to_string()
                                        }
                                    } else {
                                        "JS callback failed".to_string()
                                    }
                                } else {
                                    "JS callback failed".to_string()
                                }
                            } else {
                                "JS callback failed".to_string()
                            };
                            return Err(ottavino::Error::from(anyhow::Error::msg(err_msg)));
                        }
                        match Unknown::from_napi_value(env.raw(), result_raw) {
                            Ok(res) => res,
                            Err(e) => return Err(ottavino::Error::from(anyhow::Error::msg(e.to_string()))),
                        }
                    };

                    let lua_res = match js_to_ottavino_value(&env, ctx, js_res) {
                        Ok(val) => val,
                        Err(e) => return Err(ottavino::Error::from(anyhow::Error::msg(e.to_string()))),
                    };

                    stack.replace(ctx, lua_res);

                    Ok(ottavino::CallbackReturn::Return)
                },
            );

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
