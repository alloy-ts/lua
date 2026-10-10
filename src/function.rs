use napi_derive::napi;

use ottavino::{Context as OContext, Function as OFunction, Value as OValue};

use crate::lua::Context;
use crate::value::Value;

/// Opaque, erased-lifetime handle to an `ottavino::Function<'gc>`.
///
/// Valid only inside the `enter` callback that produced it.
#[napi]
#[derive(Clone, Copy)]
pub struct Function {
    inner: OFunction<'static>,
}

impl Function {
    /// Wrap an `ottavino::Function` as an opaque handle (erasing its lifetime).
    pub(crate) fn from_ottavino(f: OFunction) -> Self {
        Function {
            inner: unsafe { std::mem::transmute::<OFunction, OFunction<'static>>(f) },
        }
    }

    /// Recover the `ottavino::Function` (with an arbitrary lifetime). Only call inside the
    /// originating `enter` callback.
    pub(crate) fn as_ottavino<'a>(&self) -> OFunction<'a> {
        unsafe { std::mem::transmute::<OFunction<'static>, OFunction<'a>>(self.inner) }
    }
}

#[napi]
impl Function {
    /// Compose functions together into a single function.
    ///
    /// Given `[f, g, h]`, the result calls `h(g(f(...)))` — the first function is called first.
    ///
    /// `ctx` must be the `Context` bridge from the active `enter` callback.
    #[napi]
    pub fn compose(ctx: &Context, functions: Vec<Function>) -> Function {
        let octx = ctx.as_ottavino();
        let ofunctions: Vec<OFunction> = functions.iter().map(|f| f.as_ottavino()).collect();
        // `Context` derefs to `Mutation`, so `&octx` coerces to `&Mutation`.
        Function::from_ottavino(OFunction::compose(&octx, ofunctions))
    }

    /// Bind a leading argument to this function, producing a new function.
    ///
    /// `ctx` must be the `Context` bridge from the active `enter` callback. `args` is a single Lua
    /// value bound as the leading argument(s); binding *multiple* arguments is a TODO (requires
    /// `Variadic` / tuple handling in `crate::value`).
    #[napi]
    pub fn bind(&self, ctx: &Context, args: Value) -> Function {
        let octx = ctx.as_ottavino();
        let f = self.as_ottavino();
        let oargs = args.as_ottavino();
        Function::from_ottavino(f.bind(&octx, oargs))
    }
}

// TODO: to *invoke* a `Function` from JS, build a `Thread`/`Executor` from it (see `crate::thread`)
// and drive it with `Lua::execute`. A `Function::call(args)` that runs inside the active `enter`
// callback could be added if direct invocation is desired.
