use napi::bindgen_prelude::{Env, Object as JsObject, Unknown, ValueType};
use napi::{JsNumber, JsString, JsValue};
use napi::Error as NapiError;
use napi_derive::napi;
use ottavino::{
    Closure,
    Context as OContext,
    Executor,
    IntoValue,
    Lua as OLua,
    Table as OTable,
    Value as OValue,
};

fn to_napi_err<E: std::fmt::Display>(e: E) -> NapiError {
    NapiError::from_reason(e.to_string())
}

enum JsVal {
    Nil,
    Boolean(bool),
    Integer(i64),
    Number(f64),
    String(Vec<u8>),
}

fn js_val_to_unknown<'a>(env: &'a Env, val: JsVal) -> napi::Result<Unknown<'a>> {
    match val {
        JsVal::Nil => unsafe {
            let mut napi_val = std::ptr::null_mut();
            napi::sys::napi_get_undefined(env.raw(), &mut napi_val);
            Ok(Unknown::from_raw_unchecked(env.raw(), napi_val))
        },
        JsVal::Boolean(b) => unsafe {
            let mut napi_val = std::ptr::null_mut();
            napi::sys::napi_get_boolean(env.raw(), b, &mut napi_val);
            Ok(Unknown::from_raw_unchecked(env.raw(), napi_val))
        },
        JsVal::Integer(i) => unsafe {
            let mut napi_val = std::ptr::null_mut();
            napi::sys::napi_create_int64(env.raw(), i, &mut napi_val);
            Ok(Unknown::from_raw_unchecked(env.raw(), napi_val))
        },
        JsVal::Number(f) => unsafe {
            let mut napi_val = std::ptr::null_mut();
            napi::sys::napi_create_double(env.raw(), f, &mut napi_val);
            Ok(Unknown::from_raw_unchecked(env.raw(), napi_val))
        },
        JsVal::String(bytes) => {
            let str_slice = std::str::from_utf8(&bytes).map_err(to_napi_err)?;
            unsafe {
                let mut napi_val = std::ptr::null_mut();
                napi::sys::napi_create_string_utf8(
                    env.raw(),
                    str_slice.as_ptr() as *const _,
                    str_slice.len().try_into().unwrap(),
                    &mut napi_val,
                );
                Ok(Unknown::from_raw_unchecked(env.raw(), napi_val))
            }
        }
    }
}

fn js_to_ottavino_val<'gc>(
    env: &Env,
    ctx: OContext<'gc>,
    val: &Unknown,
) -> napi::Result<OValue<'gc>> {
    let value_type = val.get_type()?;
    match value_type {
        ValueType::Undefined | ValueType::Null => Ok(OValue::Nil),
        ValueType::Boolean => {
            let mut b = false;
            let status = unsafe { napi::sys::napi_get_value_bool(env.raw(), val.raw(), &mut b) };
            if status != napi::sys::Status::napi_ok {
                return Err(NapiError::from_reason("Failed to get boolean value"));
            }
            Ok(OValue::Boolean(b))
        }
        ValueType::Number => {
            let js_num: JsNumber = unsafe { val.cast::<JsNumber>()? };
            let num: f64 = js_num.get_double()?;
            if num.fract() == 0.0 && num >= (i64::MIN as f64) && num <= (i64::MAX as f64) {
                Ok(OValue::Integer(num as i64))
            } else {
                Ok(OValue::Number(num))
            }
        }
        ValueType::String => {
            let js_str: JsString = unsafe { val.cast::<JsString>()? };
            let utf8 = js_str.into_utf8()?;
            let str_bytes = utf8.as_slice();
            Ok(OValue::String(ctx.intern(str_bytes)))
        }
        ValueType::Object => {
            let table = OTable::new(&ctx);
            let prop_names: JsObject = unsafe {
                let mut names_raw = std::ptr::null_mut();
                let status = napi::sys::napi_get_property_names(
                    env.raw(),
                    val.raw(),
                    &mut names_raw,
                );
                if status != napi::sys::Status::napi_ok {
                    return Err(NapiError::from_reason("Failed to get property names"));
                }
                JsObject::from_raw(env.raw(), names_raw)
            };

            let mut len: u32 = 0;
            unsafe {
                napi::sys::napi_get_array_length(env.raw(), prop_names.raw(), &mut len);
            }

            for i in 0..len {
                let key_js: Unknown = unsafe {
                    let mut elem_raw = std::ptr::null_mut();
                    napi::sys::napi_get_element(env.raw(), prop_names.raw(), i, &mut elem_raw);
                    Unknown::from_raw_unchecked(env.raw(), elem_raw)
                };

                let key_str: JsString = unsafe { key_js.cast::<JsString>()? };
                let key_utf8 = key_str.into_utf8()?;
                let key_bytes = key_utf8.as_slice();
                let key_ott = match ctx.intern(key_bytes).into_value(ctx) {
                    OValue::String(s) => s,
                    _ => unreachable!(),
                };

                let val_js: Unknown = unsafe {
                    let mut prop_raw = std::ptr::null_mut();
                    napi::sys::napi_get_property(env.raw(), val.raw(), key_js.raw(), &mut prop_raw);
                    Unknown::from_raw_unchecked(env.raw(), prop_raw)
                };

                let val_ott = js_to_ottavino_val(env, ctx, &val_js)?;
                let _ = table.set(ctx, key_ott, val_ott);
            }
            Ok(OValue::Table(table))
        }
        _ => Err(NapiError::from_reason("Unsupported type for setGlobal")),
    }
}

/// A Lua execution environment exposed via NAPI.
#[napi]
pub struct Lua {
    inner: OLua,
}

#[napi]
impl Lua {
    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: OLua::full(),
        }
    }

    /// Create a `Lua` instance with core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: OLua::core(),
        }
    }

    /// Create an empty `Lua` instance.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: OLua::empty(),
        }
    }

    /// Set a global variable or constant in the Lua environment from a JS value (primitive or object).
    #[napi(js_name = "setGlobal")]
    pub fn set_global(&mut self, env: Env, name: String, value: Unknown) -> napi::Result<()> {
        let mut set_err = None;

        self.inner.enter(|ctx| {
            let globals = ctx.globals();

            let lua_val = match js_to_ottavino_val(&env, ctx, &value) {
                Ok(v) => v,
                Err(e) => {
                    set_err = Some(e);
                    return;
                }
            };

            let name_key = match ctx.intern(name.as_bytes()).into_value(ctx) {
                OValue::String(s) => s,
                _ => unreachable!(),
            };
            let _ = globals.set(ctx, name_key, lua_val);
        });

        if let Some(err) = set_err {
            return Err(err);
        }

        Ok(())
    }

    /// Evaluate a Lua script/expression string and return the result value converted to JS.
    #[napi]
    pub fn eval<'a>(&mut self, env: &'a Env, code: String) -> napi::Result<Unknown<'a>> {
        let mut stashed_exec = None;
        let mut compile_err = None;

        self.inner.enter(|ctx| {
            let closure = match Closure::load(ctx, Some("eval"), code.as_bytes()) {
                Ok(c) => c,
                Err(e) => {
                    compile_err = Some(to_napi_err(e));
                    return;
                }
            };

            let exec = Executor::start(ctx, closure.into(), ());
            stashed_exec = Some(ctx.stash(exec));
        });

        if let Some(err) = compile_err {
            return Err(err);
        }

        let executor = match stashed_exec {
            Some(e) => e,
            None => return Err(NapiError::from_reason("Failed to create executor")),
        };

        self.inner
            .finish(&executor)
            .map_err(to_napi_err)?;

        let mut res_js_val = JsVal::Nil;
        self.inner.try_enter(|ctx| {
            let exec = ctx.fetch(&executor);
            let val: OValue = exec.take_result(ctx)??;
            res_js_val = match val {
                OValue::Nil => JsVal::Nil,
                OValue::Boolean(b) => JsVal::Boolean(b),
                OValue::Integer(i) => JsVal::Integer(i),
                OValue::Number(f) => JsVal::Number(f),
                OValue::String(s) => JsVal::String(s.as_bytes().to_vec()),
                _ => JsVal::Nil,
            };
            Ok(())
        }).map_err(to_napi_err)?;

        js_val_to_unknown(env, res_js_val)
    }
}
