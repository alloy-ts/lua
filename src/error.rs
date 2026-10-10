use napi_derive::napi;
use ottavino::{ExternError as OExternError, RuntimeError as ORuntimeError};

/// A shareable, dynamically typed wrapper around a Rust error, safe to hand to JS.
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
            inner: ORuntimeError::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                message,
            )),
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
