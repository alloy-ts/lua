use napi::bindgen_prelude::*;
use napi::Env;
use napi_derive::napi;
use ottavino::{Context, Lua as OLua, Value as OValue};

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

/// A Lua execution environment.
#[napi]
pub struct Lua {
    inner: OLua,
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
        Lua { inner: OLua::full() }
    }

    /// Create a new `Lua` instance with the core standard library loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua { inner: OLua::core() }
    }

    /// Create a new `Lua` instance with no standard library loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua { inner: OLua::empty() }
    }

    /// Load the core parts of the stdlib (non-I/O).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.load_core();
    }

    /// Load the I/O parts of the stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.load_io();
    }

    /// Evaluate a string of Lua code and return the result.
    #[napi]
    pub fn eval(&mut self, env: Env, source: String) -> napi::Result<Unknown<'_>> {
        let executor = self
            .inner
            .try_enter(|ctx| {
                let closure = ottavino::Closure::load(ctx, None, source.as_bytes())?;
                let function = ottavino::Function::Closure(closure);
                Ok(ctx.stash(ottavino::Executor::start(ctx, function, ())))
            })
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        self.inner
            .finish(&executor)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        self.inner.enter(move |ctx| {
            let lua_val = ctx
                .fetch(&executor)
                .take_result::<OValue>(ctx)
                .map_err(|e| napi::Error::from_reason(e.to_string()))?
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            lua_value_to_js(&env, ctx, lua_val)
        })
    }

    /// Set a global variable in the Lua state.
    #[napi]
    pub fn set_global(&mut self, env: Env, name: String, value: Unknown) -> napi::Result<()> {
        self.inner
            .enter(move |ctx| -> napi::Result<()> {
                let lua_val = js_to_lua_value(&env, ctx, value)?;
                let name_str = ctx.intern(name.as_bytes());
                ctx.globals()
                    .set_raw(&ctx, OValue::String(name_str), lua_val)
                    .map_err(|e| napi::Error::from_reason(e.to_string()))?;
                Ok(())
            })
    }

    /// Get a global variable from the Lua state.
    #[napi]
    pub fn get_global(&mut self, env: Env, name: String) -> napi::Result<Unknown<'_>> {
        self.inner
            .enter(move |ctx| -> napi::Result<Unknown> {
                let name_str = ctx.intern(name.as_bytes());
                let lua_val = ctx.globals().get_raw(OValue::String(name_str));
                lua_value_to_js(&env, ctx, lua_val)
            })
    }
}
