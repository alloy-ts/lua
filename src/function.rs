use napi_derive::napi;
use ottavino::Function as OFunction;

/// Opaque, erased-lifetime handle to an `ottavino::Function<'gc>`.
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

    /// Recover the `ottavino::Function` (with an arbitrary lifetime).
    pub(crate) fn as_ottavino<'a>(&self) -> OFunction<'a> {
        unsafe { std::mem::transmute::<OFunction<'static>, OFunction<'a>>(self.inner) }
    }
}
