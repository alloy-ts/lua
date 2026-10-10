use napi_derive::napi;

use ottavino::{ExternError as OExternError, RuntimeError as ORuntimeError};

/// A shareable, dynamically typed wrapper around a Rust error, safe to hand to JS.
///
/// Construct one with [`RuntimeError::from_message`] and later raise it into Lua (TODO above).
#[napi]
pub struct RuntimeError {
    inner: ORuntimeError,
}

#[napi]
impl RuntimeError {
    /// Create a runtime error from a message string.
    #[napi(factory)]
    pub fn from_message(message: String) -> Self {
        RuntimeError {
            inner: ORuntimeError::new(message),
        }
    }

    /// Human-readable message (the `Display` of the underlying error).
    #[napi]
    pub fn message(&self) -> String {
        self.inner.to_string()
    }
}

/// An `enum@Error` that is not bound to the GC context. Safe to hand to JS.
#[napi]
pub struct ExternError {
    inner: OExternError,
}

#[napi]
impl ExternError {
    /// Human-readable message.
    #[napi]
    pub fn message(&self) -> String {
        self.inner.to_string()
    }

    /// `"lua"` if the error carries a Lua value, or `"runtime"` if it carries a Rust error.
    #[napi]
    pub fn kind(&self) -> String {
        match &self.inner {
            OExternError::Lua(_) => "lua".to_string(),
            OExternError::Runtime(_) => "runtime".to_string(),
        }
    }
}
