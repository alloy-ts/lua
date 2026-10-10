use napi_derive::napi;
use ottavino::{
    Closure as OClosure, Context as OContext, Executor as OExecutor, Lua as OLua,
};

/// Snapshot of `ottavino_gc_arena::metrics::Metrics`.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator (mirrors `Lua::total_memory`).
    pub total_allocation: f64,
    /// Current allocation debt; when it exceeds a small constant, `enter` triggers a collection.
    pub allocation_debt: f64,
}

/// A Lua execution environment. Top-level `ottavino` type; create one, then execute code.
#[napi]
pub struct Lua {
    inner: OLua,
}

#[napi]
impl Lua {
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

    /// Create a `Lua` instance with the full stdlib (including I/O) loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        Lua {
            inner: OLua::full(),
        }
    }

    /// Load the core parts of the stdlib that do not allow performing any I/O.
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.load_core();
    }

    /// Load the parts of the stdlib that allow I/O.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.load_io();
    }

    /// Size of all memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.total_memory() as f64
    }

    /// Finish the current collection cycle completely.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.gc_collect();
    }

    /// Snapshot of the garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let m = self.inner.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Set a global string variable in the Lua environment.
    #[napi]
    pub fn set_global(&mut self, key: String, value: String) {
        self.inner.enter(|ctx| {
            let key_str = ctx.intern(key.as_bytes());
            let val_str = ctx.intern(value.as_bytes());
            ctx.globals().set(ctx, key_str, val_str).unwrap();
        });
    }

    /// Compile and evaluate Lua code, returning the string representation of the result value.
    #[napi]
    pub fn eval(&mut self, code: String) -> napi::Result<String> {
        let mut stashed_executor = None;
        let mut parse_err = None;

        self.inner.enter(|ctx| {
            match OClosure::load(ctx, Some("eval"), code.as_bytes()) {
                Ok(closure) => {
                    let executor = OExecutor::start(ctx, closure.into(), ());
                    stashed_executor = Some(ctx.stash(executor));
                }
                Err(e) => {
                    parse_err = Some(e.to_string());
                }
            }
        });

        if let Some(e) = parse_err {
            return Err(napi::Error::new(napi::Status::GenericFailure, e));
        }

        let stashed_executor = stashed_executor.unwrap();

        if let Err(e) = self.inner.finish(&stashed_executor) {
            return Err(napi::Error::new(napi::Status::GenericFailure, e.to_string()));
        }

        let mut output = String::new();
        let mut exec_err = None;

        self.inner.enter(|ctx| {
            let executor = ctx.fetch(&stashed_executor);
            match executor.take_result::<ottavino::Value>(ctx) {
                Ok(Ok(val)) => {
                    output = val.display().to_string();
                }
                Ok(Err(err)) => {
                    exec_err = Some(err.to_string());
                }
                Err(err) => {
                    exec_err = Some(err.to_string());
                }
            }
        });

        if let Some(e) = exec_err {
            return Err(napi::Error::new(napi::Status::GenericFailure, e));
        }

        Ok(output)
    }
}

/// Erased layout of `ottavino::Context<'gc>` (two `&` references => two pointers).
#[repr(C)]
#[derive(Clone, Copy)]
struct RawCtx {
    mutation: *mut (),
    state: *mut (),
}

/// A bridge object handed to Lua callbacks or interactions.
#[napi]
#[derive(Clone, Copy)]
pub struct Context {
    raw: RawCtx,
}

impl Context {
    /// Erase the `'gc` lifetime and wrap an `ottavino::Context`.
    #[allow(dead_code)]
    pub(crate) fn from_raw<'gc>(ctx: OContext<'gc>) -> Self {
        let raw = unsafe { std::mem::transmute::<OContext<'gc>, RawCtx>(ctx) };
        Context { raw }
    }

    /// Recover the `ottavino::Context` (with an arbitrary lifetime).
    #[allow(dead_code)]
    pub(crate) fn as_ottavino<'a>(&self) -> OContext<'a> {
        unsafe { std::mem::transmute::<RawCtx, OContext<'a>>(self.raw) }
    }
}
