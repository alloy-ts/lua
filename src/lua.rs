use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::*;
use napi::Env;
use napi_derive::napi;
use ottavino::{Context, Lua as OLua, Value as OValue};

/// Snapshot of GC metrics from the Lua arena.
#[napi(object)]
pub struct GcMetrics {
    pub total_allocation: f64,
    pub allocation_debt: f64,
}

/// Result of stepping an Executor.
#[napi(object)]
pub struct StepResult<'a> {
    pub done: bool,
    pub result: Option<Unknown<'a>>,
}

fn call_js_function<'a>(
    env: &Env,
    function: &Function<'_, (), Unknown>,
    args: &[Unknown],
) -> napi::Result<Unknown<'a>> {
    let raw_args: Vec<napi::sys::napi_value> = args.iter().map(|u| u.raw()).collect();
    let mut raw_this = std::ptr::null_mut();
    unsafe { napi::sys::napi_get_undefined(env.raw(), &mut raw_this) };
    let mut return_value = std::ptr::null_mut();
    let status = unsafe {
        napi::sys::napi_call_function(
            env.raw(),
            raw_this,
            function.raw(),
            raw_args.len(),
            raw_args.as_ptr(),
            &mut return_value,
        )
    };
    if status != napi::sys::Status::napi_ok {
        return Err(napi::Error::from_status(napi::Status::from(status)));
    }
    Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), return_value) })
}

fn lua_value_to_js<'a, 'gc>(
    env: &Env,
    ctx: Context<'gc>,
    val: OValue<'gc>,
) -> napi::Result<Unknown<'a>> {
    let raw_val = unsafe {
        match val {
            OValue::Nil => ToNapiValue::to_napi_value(env.raw(), ())?,
            OValue::Boolean(b) => ToNapiValue::to_napi_value(env.raw(), b)?,
            OValue::Integer(i) => ToNapiValue::to_napi_value(env.raw(), i)?,
            OValue::Number(n) => ToNapiValue::to_napi_value(env.raw(), n)?,
            OValue::String(s) => {
                let str_val = String::from_utf8_lossy(s.as_bytes()).to_string();
                ToNapiValue::to_napi_value(env.raw(), str_val)?
            }
            OValue::Table(t) => {
                let mut obj = Object::new(env)?;
                for (k, v) in t.iter() {
                    let key_js = match k {
                        OValue::String(s) => String::from_utf8_lossy(s.as_bytes()).to_string(),
                        OValue::Integer(i) => i.to_string(),
                        OValue::Number(n) => n.to_string(),
                        _ => continue,
                    };
                    let val_js = lua_value_to_js(env, ctx, v)?;
                    obj.set_named_property(&key_js, val_js)?;
                }
                let napi_obj_val = ToNapiValue::to_napi_value(env.raw(), obj)?;
                return Ok(Unknown::from_raw_unchecked(env.raw(), napi_obj_val));
            }
            _ => ToNapiValue::to_napi_value(env.raw(), ())?,
        }
    };
    Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), raw_val) })
}

fn js_to_lua_value<'gc>(
    env: &Env,
    ctx: Context<'gc>,
    val: Unknown,
) -> napi::Result<OValue<'gc>> {
    let value_type = val.get_type()?;
    match value_type {
        ValueType::Undefined | ValueType::Null => Ok(OValue::Nil),
        ValueType::Boolean => {
            let b: bool = unsafe { val.cast()? };
            Ok(OValue::Boolean(b))
        }
        ValueType::Number => {
            let n: f64 = unsafe { val.cast()? };
            if n.fract() == 0.0 && n >= (i64::MIN as f64) && n <= (i64::MAX as f64) {
                Ok(OValue::Integer(n as i64))
            } else {
                Ok(OValue::Number(n))
            }
        }
        ValueType::String => {
            let s: String = unsafe { val.cast()? };
            let lua_str = ctx.intern(s.as_bytes());
            Ok(OValue::String(lua_str))
        }
        ValueType::Function => {
            let callback: Function = unsafe { val.cast()? };
            let fn_ref: FunctionRef<(), Unknown> = unsafe { FunctionRef::from_napi_value(env.raw(), callback.raw())? };
            let env_clone = env.clone();
            let cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let len = stack.len();
                let mut js_args = Vec::with_capacity(len);
                for i in 0..len {
                    let val = stack.get(i);
                    let js_val = lua_value_to_js(&env_clone, ctx, val)
                        .map_err(|e| ottavino::RuntimeError::new(e))?;
                    js_args.push(js_val);
                }
                let function = fn_ref
                    .borrow_back(&env_clone)
                    .map_err(|e| ottavino::RuntimeError::new(e))?;
                let ret_js: Unknown = call_js_function(&env_clone, &function, &js_args)
                    .map_err(|e| ottavino::RuntimeError::new(e))?;
                let ret_lua = js_to_lua_value(&env_clone, ctx, ret_js)
                    .map_err(|e| ottavino::RuntimeError::new(e))?;
                stack.replace(ctx, ret_lua);
                Ok(ottavino::CallbackReturn::Return)
            });
            Ok(OValue::Function(ottavino::Function::Callback(cb)))
        }
        ValueType::Object => {
            let obj: Object = unsafe { val.cast()? };
            if obj.is_array()? {
                let len = obj.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    if let Ok(elem) = obj.get_element::<Unknown>(i) {
                        let elem_lua = js_to_lua_value(env, ctx, elem)?;
                        let _ = table.set_raw(
                            &ctx,
                            OValue::Integer((i + 1) as i64),
                            elem_lua,
                        );
                    }
                }
                Ok(OValue::Table(table))
            } else {
                let names = obj.get_property_names()?;
                let len = names.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    if let Ok(key_js) = names.get_element::<Unknown>(i) {
                        if let Ok(key_str) = unsafe { key_js.cast::<String>() } {
                            if let Ok(elem) = obj.get_named_property::<Unknown>(&key_str) {
                                let elem_lua = js_to_lua_value(env, ctx, elem)?;
                                let key_lua_str = ctx.intern(key_str.as_bytes());
                                let _ = table.set_raw(
                                    &ctx,
                                    OValue::String(key_lua_str),
                                    elem_lua,
                                );
                            }
                        }
                    }
                }
                Ok(OValue::Table(table))
            }
        }
        _ => Ok(OValue::Nil),
    }
}

/// Globals table handle for interacting with global variables (_ENV / ctx.globals()).
#[napi]
pub struct Globals {
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Globals {
    /// Get a global variable from the Lua environment.
    #[napi]
    pub fn get<'a>(&self, env: Env, name: String) -> napi::Result<Unknown<'a>> {
        let mut lua = self.inner.lock().unwrap();
        lua.enter(move |ctx| -> napi::Result<Unknown> {
            let name_str = ctx.intern(name.as_bytes());
            let lua_val = ctx.globals().get_raw(OValue::String(name_str));
            lua_value_to_js(&env, ctx, lua_val)
        })
    }

    /// Set a global variable in the Lua environment.
    ///
    /// Accepts primitives, objects/arrays (converted to Lua tables), and JS functions (converted to Ottavino Callbacks).
    #[napi(ts_args_type = "name: string, value: any")]
    pub fn set(&self, env: Env, name: String, value: Unknown) -> napi::Result<()> {
        let mut lua = self.inner.lock().unwrap();
        lua.enter(move |ctx| -> napi::Result<()> {
            let lua_val = js_to_lua_value(&env, ctx, value)?;
            let name_str = ctx.intern(name.as_bytes());
            ctx.globals()
                .set_raw(&ctx, OValue::String(name_str), lua_val)
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            Ok(())
        })
    }
}

/// A handle to a stepped Lua Executor.
#[napi]
pub struct Executor {
    stashed: ottavino::StashedExecutor,
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Executor {
    /// Run execution for a number of fuel steps.
    #[napi]
    pub fn step(&mut self, env: Env, fuel: i32) -> napi::Result<StepResult<'_>> {
        let mut lua = self.inner.lock().unwrap();
        let mut f = ottavino::Fuel::with(fuel);
        let done = lua
            .enter(|ctx| ctx.fetch(&self.stashed).step(ctx, &mut f))
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        if done {
            let stashed = self.stashed.clone();
            lua.enter(move |ctx| {
                let res = ctx
                    .fetch(&stashed)
                    .take_result::<OValue>(ctx)
                    .map_err(|e| napi::Error::from_reason(e.to_string()))?
                    .map_err(|e| napi::Error::from_reason(e.to_string()))?;
                let val_js = lua_value_to_js(&env, ctx, res)?;
                Ok(StepResult {
                    done: true,
                    result: Some(val_js),
                })
            })
        } else {
            Ok(StepResult {
                done: false,
                result: None,
            })
        }
    }
}

/// A Lua execution environment.
#[napi]
pub struct Lua {
    inner: Arc<Mutex<OLua>>,
}

#[napi]
impl Default for Lua {
    fn default() -> Self {
        Self::new()
    }
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full standard library loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::full())),
        }
    }

    /// Create a new `Lua` instance with the core standard library loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::core())),
        }
    }

    /// Create a new `Lua` instance with no standard library loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: Arc::new(Mutex::new(OLua::empty())),
        }
    }

    /// Load the core parts of the stdlib (non-I/O).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.lock().unwrap().load_core();
    }

    /// Load the I/O parts of the stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.lock().unwrap().load_io();
    }

    /// Total memory used by this Lua instance, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.lock().unwrap().total_memory() as f64
    }

    /// Trigger a full garbage collection cycle in Lua.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.lock().unwrap().gc_collect();
    }

    /// Get current garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let lua = self.inner.lock().unwrap();
        let m = lua.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Get the Globals handle for interacting with global variables (_ENV / ctx.globals()).
    #[napi]
    pub fn globals(&self) -> Globals {
        Globals {
            inner: Arc::clone(&self.inner),
        }
    }

    /// Create a step-driven Executor for fuel-metered or cancellable execution.
    #[napi]
    pub fn executor(&mut self, source: String) -> napi::Result<Executor> {
        let mut lua = self.inner.lock().unwrap();
        let stashed = lua
            .try_enter(|ctx| {
                let closure = ottavino::Closure::load(ctx, None, source.as_bytes())?;
                let function = ottavino::Function::Closure(closure);
                Ok(ctx.stash(ottavino::Executor::start(ctx, function, ())))
            })
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        Ok(Executor {
            stashed,
            inner: Arc::clone(&self.inner),
        })
    }

    /// Register a JavaScript function as a callback reachable from Lua scripts.
    #[napi(ts_args_type = "name: string, callback: (...args: any[]) => any")]
    pub fn register_callback(
        &mut self,
        env: Env,
        name: String,
        callback: Unknown,
    ) -> napi::Result<()> {
        Globals {
            inner: Arc::clone(&self.inner),
        }
        .set(env, name, callback)
    }

    /// Evaluate a string of Lua code and return the result.
    #[napi]
    pub fn eval(&mut self, env: Env, source: String) -> napi::Result<Unknown<'_>> {
        let mut lua = self.inner.lock().unwrap();
        let executor = lua
            .try_enter(|ctx| {
                let closure = ottavino::Closure::load(ctx, None, source.as_bytes())?;
                let function = ottavino::Function::Closure(closure);
                Ok(ctx.stash(ottavino::Executor::start(ctx, function, ())))
            })
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        lua.finish(&executor)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        lua.enter(move |ctx| {
            let lua_val = ctx
                .fetch(&executor)
                .take_result::<OValue>(ctx)
                .map_err(|e| napi::Error::from_reason(e.to_string()))?
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            lua_value_to_js(&env, ctx, lua_val)
        })
    }

    /// Set a global variable in the Lua state.
    #[napi(ts_args_type = "name: string, value: any")]
    pub fn set_global(&mut self, env: Env, name: String, value: Unknown) -> napi::Result<()> {
        Globals {
            inner: Arc::clone(&self.inner),
        }
        .set(env, name, value)
    }

    /// Get a global variable from the Lua state.
    #[napi]
    pub fn get_global(&mut self, env: Env, name: String) -> napi::Result<Unknown<'_>> {
        Globals {
            inner: Arc::clone(&self.inner),
        }
        .get(env, name)
    }
}
