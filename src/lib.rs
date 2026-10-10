use napi::bindgen_prelude::*;
use napi_derive::napi;
use ottavino::{Closure, Executor, Function, Lua as OLua, Value as OValue};

#[napi]
pub struct Lua {
    inner: OLua,
}

#[napi]
impl Lua {
    #[napi(constructor)]
    pub fn new() -> Self {
        Lua {
            inner: OLua::full(),
        }
    }

    #[napi]
    pub fn eval(&mut self, code: String) -> Result<String> {
        let exec = self
            .inner
            .enter(|ctx| {
                let closure = Closure::load(ctx, Some("eval"), code.as_bytes())
                    .map_err(|e| napi::Error::from_reason(e.to_string()))?;
                let func = Function::Closure(closure);
                let executor = Executor::start(ctx, func, ());
                Ok::<_, napi::Error>(ctx.stash(executor))
            })?;

        self.inner
            .finish(&exec)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        self.inner.enter(|ctx| {
            let res = ctx
                .fetch(&exec)
                .take_result::<OValue>(ctx)
                .map_err(|e| napi::Error::from_reason(e.to_string()))?
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;

            match res {
                OValue::Nil => Ok("nil".to_string()),
                OValue::Boolean(b) => Ok(b.to_string()),
                OValue::Integer(i) => Ok(i.to_string()),
                OValue::Number(n) => Ok(n.to_string()),
                OValue::String(s) => Ok(String::from_utf8_lossy(s.as_bytes()).to_string()),
                _ => Ok(format!("{:?}", res)),
            }
        })
    }
}
