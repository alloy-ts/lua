use napi::bindgen_prelude::{Buffer, Env, Function, ToNapiValue, Unknown};
use napi::Error as NapiError;
use napi_derive::napi;

use ottavino::{Context as OContext, Lua as OLua};

/// Convert any displayable error into a `napi::Error` so `ottavino` error types can cross the
/// FFI boundary.
fn to_napi_err<E: std::fmt::Display>(e: E) -> NapiError {
    NapiError::from_reason(e.to_string())
}

/// Snapshot of `ottavino_gc_arena::metrics::Metrics`.
///
/// `Lua::gc_metrics` borrows `&Metrics` from the arena, which cannot be returned by reference to
/// JS, so we copy the numbers we care about into an owned object.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator (mirrors `Lua::total_memory`).
    pub total_allocation: f64,
    /// Current allocation debt; when it exceeds a small constant, `enter` triggers a collection.
    pub allocation_debt: f64,
}

/// A Lua execution environment. Top-level `ottavino` type; create one, then `enter` it to run code.
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
    ///
    /// Calls `load_base`, `load_coroutine`, `load_math`, `load_string`, `load_table`.
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

    /// Enter the garbage collection arena and run `callback(ctx)`.
    ///
    /// `ctx` is a [`Context`] bridge that is only valid synchronously inside `callback`. Any Lua
    /// values obtained from `ctx` (via `ctx.globals()`, `ctx.intern(...)`, ...) are opaque handles
    /// that must not be used after `callback` returns.
    #[napi]
    pub fn enter(&mut self, env: Env, callback: Function) -> Result<()> {
        let mut result: Result<(), NapiError> = Ok(());
        self.inner.enter(|ctx| {
            if let Err(e) = Self::run_callback(env, &callback, ctx) {
                result = Err(e);
            }
        });
        result
    }

    /// Like [`Lua::enter`], but the closure is allowed to fail. Any JS-side error is captured and
    /// surfaced as the returned `Result`.
    ///
    /// NOTE: The underlying `ottavino::Lua::try_enter` expects the closure to produce an
    /// `ottavino::Error`. Since our closure only talks to JS (it never produces an `ottavino`
    /// error directly), this currently behaves like `enter` with respect to error reporting.
    /// Mapping a JS exception back into an `ottavino::Error` is left as a TODO.
    #[napi]
    pub fn try_enter(&mut self, env: Env, callback: Function) -> Result<()> {
        let mut result: Result<(), NapiError> = Ok(());
        let _ = self.inner.try_enter(|ctx| {
            match Self::run_callback(env, &callback, ctx) {
                Ok(()) => Ok(()),
                Err(e) => {
                    result = Err(e);
                    Ok(())
                }
            }
        });
        result
    }

    /// Run the given executor to completion.
    ///
    /// Requires the `StashedExecutor` NAPI handle from `crate::stash`.
    #[napi]
    pub fn finish(&mut self, executor: &crate::stash::StashedExecutor) -> Result<()> {
        self.inner.finish(executor.inner()).map_err(to_napi_err)
    }

    /// Run the given executor to completion and return its first result value.
    ///
    /// Requires the `StashedExecutor` NAPI handle from `crate::stash`. Multi-value returns are
    /// left as a TODO (would need `Vec<Value>` / `Variadic` handling in `crate::value`).
    #[napi]
    pub fn execute(
        &mut self,
        executor: &crate::stash::StashedExecutor,
    ) -> Result<crate::value::Value> {
        let r: ottavino::Value = self
            .inner
            .execute::<ottavino::Value>(executor.inner())
            .map_err(to_napi_err)?;
        Ok(crate::value::Value::from_ottavino(r))
    }

    /// Internal helper: build a [`Context`] bridge for `ctx`, wrap it as a JS value, and invoke
    /// the JS callback with it as the single argument.
    fn run_callback(env: Env, callback: &Function, ctx: OContext) -> Result<(), NapiError> {
        let bridge = Context::from_raw(ctx);
        let napi_value = <Context as ToNapiValue>::to_napi_value(env, bridge)
            .map_err(|e| NapiError::from_reason(e.to_string()))?;
        let arg = Unknown::from_napi_value(env, napi_value)?;
        callback.call(None, &[arg])?;
        Ok(())
    }
}

/// Erased layout of `ottavino::Context<'gc>` (two `&` references => two pointers).
///
/// We transmute `Context<'gc>` <-> `RawCtx` to smuggle the branded lifetime across the FFI
/// boundary. This is sound **only** for the duration of a single synchronous `enter` callback.
#[repr(C)]
struct RawCtx {
    mutation: *mut (),
    state: *mut (),
}

/// A bridge object handed to the JS `enter`/`try_enter` callback.
///
/// Valid only synchronously inside the callback that received it. The raw pointers are dangling
/// once the callback returns; do not retain this object (or any value obtained through it) in JS.
#[napi]
#[derive(Clone, Copy)]
pub struct Context {
    raw: RawCtx,
}

impl Context {
    /// Erase the `'gc` lifetime and wrap an `ottavino::Context`.
    fn from_raw<'gc>(ctx: OContext<'gc>) -> Self {
        let raw = unsafe { std::mem::transmute::<OContext<'gc>, RawCtx>(ctx) };
        Context { raw }
    }

    /// Recover the `ottavino::Context` (with an arbitrary lifetime). Only call inside the
    /// originating `enter` callback.
    fn as_ottavino<'a>(&self) -> OContext<'a> {
        unsafe { std::mem::transmute::<RawCtx, OContext<'a>>(self.raw) }
    }
}

#[napi]
impl Context {
    /// The table of global variables.
    #[napi]
    pub fn globals(&self) -> crate::table::Table {
        let ctx = self.as_ottavino();
        crate::table::Table::from_ottavino(ctx.globals())
    }

    /// The registry.
    #[napi]
    pub fn registry(&self) -> crate::registry::Registry {
        let ctx = self.as_ottavino();
        crate::registry::Registry::from_ottavino(ctx.registry())
    }

    /// Intern a byte slice into an interned `String` handle.
    #[napi]
    pub fn intern(&self, data: Buffer) -> crate::string::String {
        let ctx = self.as_ottavino();
        crate::string::String::from_ottavino(ctx.intern(&data))
    }
}

// TODO(high-level): add a convenience `Lua::run(source: String) -> Value` that compiles `source`
// via `crate::compiler`, builds a `Thread`/`Executor` in `crate::thread`, and calls `execute`.
// This would let JS run Lua without manually constructing executors.
//
// TODO: `Context::get_global` / `set_global` take a `&'static str` in `ottavino`, so they cannot
// be driven from a runtime JS string. Use `ctx.globals().get/set(...)` (the `Table` handle) with a
// `Value` key instead.
