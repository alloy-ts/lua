use napi::bindgen_prelude::{
    Env, FromNapiValue, JsObjectValue, Object, ToNapiValue, ValueType,
};
use napi::{Error as NapiError, JsValue, Unknown};
use napi_derive::napi;

use ottavino::Lua as OLua;
use ottavino::{Executor, Fuel, StashedValue, ThreadMode, Variadic};

struct RawRef {
    env: napi::sys::napi_env,
    ref_ptr: napi::sys::napi_ref,
}
unsafe impl Send for RawRef {}
unsafe impl Sync for RawRef {}

impl Drop for RawRef {
    fn drop(&mut self) {
        unsafe {
            napi::sys::napi_delete_reference(self.env, self.ref_ptr);
        }
    }
}

/// Snapshot of GC metrics.
#[napi(object)]
pub struct GcMetrics {
    /// Total bytes tracked by the allocator.
    pub total_allocation: f64,
    /// Current allocation debt.
    pub allocation_debt: f64,
}

/// A Lua execution environment exported to JavaScript/TypeScript via NAPI.
///
/// Mirrors ottavino's design: the `Lua` instance owns the single GC arena (the
/// "hub"), and all execution funnels through it. GC-rooted values that must
/// survive between NAPI calls are stashed into `handles` and referred to by a
/// `usize` id (so the JS-side handle classes stay `Send`).
#[napi]
pub struct Lua {
    inner: OLua,
    handles: Vec<StashedValue>,
}

/// Handle to a Lua function (closure or host callback).
#[napi]
pub struct LuaFunction {
    id: usize,
}

/// Handle to a Lua thread / coroutine.
#[napi]
pub struct LuaThread {
    id: usize,
}

/// Handle to a Lua table.
#[napi]
pub struct LuaTable {
    id: usize,
}

/// Handle to a Lua userdata value.
#[napi]
pub struct LuaUserData {
    id: usize,
}

#[napi]
impl Lua {
    /// Create a new `Lua` instance with the full stdlib loaded.
    #[napi(constructor)]
    pub fn new() -> Self {
        let mut lua = Lua {
            inner: OLua::full(),
            handles: Vec::new(),
        };
        lua.load_io();
        lua
    }

    /// Create a `Lua` instance with no parts of the stdlib loaded.
    #[napi(factory)]
    pub fn empty() -> Self {
        Lua {
            inner: OLua::empty(),
            handles: Vec::new(),
        }
    }

    /// Create a `Lua` instance with the core (non-I/O) stdlib loaded.
    #[napi(factory)]
    pub fn core() -> Self {
        Lua {
            inner: OLua::core(),
            handles: Vec::new(),
        }
    }

    /// Create a `Lua` instance with the full stdlib loaded.
    #[napi(factory)]
    pub fn full() -> Self {
        let mut lua = Lua {
            inner: OLua::full(),
            handles: Vec::new(),
        };
        lua.load_io();
        lua
    }

    /// Load the core stdlib (base, coroutine, math, string, table).
    #[napi]
    pub fn load_core(&mut self) {
        self.inner.load_core();
    }

    /// Load the I/O stdlib.
    #[napi]
    pub fn load_io(&mut self) {
        self.inner.load_io();
        self.inner.enter(|ctx| {
            let key = ctx.intern(b"io");
            if ctx.globals().get_raw(ottavino::Value::String(key)).is_nil() {
                let io_table = ottavino::Table::new(&ctx);
                let _ = ctx.globals().set(ctx, key, ottavino::Value::Table(io_table));
            }
        });
    }

    /// Size of memory used by this Lua context, in bytes.
    #[napi]
    pub fn total_memory(&self) -> f64 {
        self.inner.total_memory() as f64
    }

    /// Run garbage collection cycle.
    #[napi]
    pub fn gc_collect(&mut self) {
        self.inner.gc_collect();
    }

    /// Get garbage collector metrics.
    #[napi]
    pub fn gc_metrics(&self) -> GcMetrics {
        let m = self.inner.gc_metrics();
        GcMetrics {
            total_allocation: m.total_allocation() as f64,
            allocation_debt: m.allocation_debt(),
        }
    }

    /// Evaluate Lua code string and return the result as a JavaScript value.
    ///
    /// Tables, functions, threads, and userdata are returned as handle objects
    /// (`LuaTable`, `LuaFunction`, `LuaThread`, `LuaUserData`) rather than
    /// placeholder strings.
    #[napi]
    pub fn eval<'js>(&mut self, env: &'js Env, code: String) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles } = self;

        let mut stashed_opt = None;
        let mut compile_err = None;

        inner.enter(
            |ctx| match ottavino::Closure::load(ctx, Some("eval"), code.as_bytes()) {
                Ok(closure) => {
                    let executor = ottavino::Executor::start(ctx, closure.into(), ());
                    stashed_opt = Some(ctx.stash(executor));
                }
                Err(err) => {
                    compile_err = Some(format!("Lua compile error: {err}"));
                }
            },
        );

        if let Some(err) = compile_err {
            return Err(NapiError::from_reason(err));
        }

        let stashed = stashed_opt.unwrap();

        if let Err(e) = inner.finish(&stashed) {
            return Err(NapiError::from_reason(format!("Lua finish error: {e}")));
        }

        let mut eval_result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("Execution failed"));

        inner.enter(|ctx| match ctx.fetch(&stashed).take_result::<ottavino::Value>(ctx) {
            Ok(Ok(val)) => {
                eval_result = ottavino_value_to_js(env, ctx, handles, val);
            }
            Ok(Err(err)) => {
                eval_result = Err(NapiError::from_reason(format!("Lua runtime error: {err}")));
            }
            Err(err) => {
                eval_result = Err(NapiError::from_reason(format!(
                    "Lua execution error: {err}"
                )));
            }
        });

        eval_result
    }

    /// Get a global variable from Lua environment by name.
    #[napi]
    pub fn get_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
    ) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles } = self;
        let mut get_result: Result<Unknown<'js>, NapiError> = ().into_unknown(env);
        inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let val = ctx.globals().get_raw(ottavino::Value::String(key));
            get_result = ottavino_value_to_js(env, ctx, handles, val);
        });

        get_result
    }

    /// Set a global variable in Lua environment by name.
    #[napi]
    pub fn set_global<'js>(
        &mut self,
        env: &'js Env,
        name: String,
        value: Unknown<'js>,
    ) -> Result<(), NapiError> {
        let mut set_result: Result<(), NapiError> = Ok(());
        self.inner
            .enter(|ctx| match js_to_ottavino_value(env, ctx, value) {
                Ok(lua_val) => {
                    let key = ctx.intern(name.as_bytes());
                    if let Err(e) = ctx.globals().set(ctx, key, lua_val) {
                        set_result = Err(NapiError::from_reason(e.to_string()));
                    }
                }
                Err(e) => {
                    set_result = Err(e);
                }
            });

        set_result
    }

    /// Runs the function to completion inside a single `enter` (mirroring
    /// `Lua::finish`'s step loop) and converts each return value.
    #[napi]
    pub fn call_function<'js>(
        &mut self,
        env: &'js Env,
        func: &LuaFunction,
        args: Vec<Unknown<'js>>,
    ) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, handles } = self;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles[func.id]);
            let ottavino::Value::Function(f) = val else {
                err = Some(NapiError::from_reason("handle is not a function"));
                return;
            };

            let mut lua_args: Vec<ottavino::Value> = Vec::with_capacity(args.len());
            for a in &args {
                match js_to_ottavino_value(env, ctx, a.clone()) {
                    Ok(v) => lua_args.push(v),
                    Err(e) => {
                        err = Some(e);
                        return;
                    }
                }
            }

            let executor = Executor::start(ctx, f, Variadic(lua_args));
            let stashed = ctx.stash(executor);
            let exec = ctx.fetch(&stashed);

            loop {
                let mut fuel = Fuel::with(4096);
                if exec.step(ctx, &mut fuel).unwrap_or(true) {
                    break;
                }
            }

            match exec.take_result::<Vec<ottavino::Value>>(ctx) {
                Ok(Ok(vals)) => {
                    for v in vals {
                        match ottavino_value_to_js(env, ctx, handles, v) {
                            Ok(u) => out.push(u),
                            Err(e) => {
                                err = Some(e);
                                return;
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    err = Some(NapiError::from_reason(format!("Lua runtime error: {e}")));
                }
                Err(e) => {
                    err = Some(NapiError::from_reason(format!(
                        "Lua execution error: {e}"
                    )));
                }
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }

    /// Return the current status of a thread handle ("stopped" | "result" |
    /// "normal" | "suspended" | "waiting" | "running").
    #[napi]
    pub fn thread_status(&mut self, thread: &LuaThread) -> Result<String, NapiError> {
        let Lua { inner, handles } = self;
        let mut result: Option<String> = None;
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles[thread.id]);
            match val {
                ottavino::Value::Thread(t) => result = Some(thread_mode_str(t.mode())),
                _ => err = Some(NapiError::from_reason("handle is not a thread")),
            }
        });

        match (err, result) {
            (Some(e), _) => Err(e),
            (None, Some(s)) => Ok(s),
            (None, None) => Err(NapiError::from_reason("no thread status")),
        }
    }

    /// Take the results of a finished (Result-mode) thread handle.
    #[napi]
    pub fn thread_take_result<'js>(
        &mut self,
        env: &'js Env,
        thread: &LuaThread,
    ) -> Result<Vec<Unknown<'js>>, NapiError> {
        let Lua { inner, handles } = self;
        let mut out: Vec<Unknown<'js>> = Vec::new();
        let mut err: Option<NapiError> = None;

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles[thread.id]);
            let ottavino::Value::Thread(t) = val else {
                err = Some(NapiError::from_reason("handle is not a thread"));
                return;
            };

            match t.take_result::<Vec<ottavino::Value>>(ctx) {
                Ok(Ok(vals)) => {
                    for v in vals {
                        match ottavino_value_to_js(env, ctx, handles, v) {
                            Ok(u) => out.push(u),
                            Err(e) => {
                                err = Some(e);
                                return;
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    err = Some(NapiError::from_reason(format!("Lua runtime error: {e}")));
                }
                Err(e) => {
                    err = Some(NapiError::from_reason(format!("bad thread mode: {e}")));
                }
            }
        });

        match err {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }

    /// Register a JS function as a global callback in Lua environment.
    #[napi]
    pub fn register_callback(
        &mut self,
        env: &Env,
        name: String,
        callback: Unknown,
    ) -> Result<(), NapiError> {
        let mut ref_ptr = std::ptr::null_mut();
        unsafe {
            let status = napi::sys::napi_create_reference(env.raw(), callback.raw(), 1, &mut ref_ptr);
            if status != napi::sys::Status::napi_ok {
                return Err(NapiError::from_reason("Failed to create function reference"));
            }
        }
        let raw_ref = std::sync::Arc::new(RawRef {
            env: env.raw(),
            ref_ptr,
        });

        let mut set_result: Result<(), NapiError> = Ok(());

        self.inner.enter(|ctx| {
            let key = ctx.intern(name.as_bytes());
            let raw_cb = raw_ref.clone();

            let lua_cb = ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| {
                let raw_env = raw_cb.env;
                let env = Env::from_raw(raw_env);

                let mut raw_func = std::ptr::null_mut();
                unsafe {
                    napi::sys::napi_get_reference_value(raw_env, raw_cb.ref_ptr, &mut raw_func);
                }

                let mut lua_args = Vec::new();
                while let Some(val) = stack.pop_back() {
                    lua_args.push(val);
                }
                lua_args.reverse();

                let mut dummy_handles = Vec::new();
                let mut js_args = Vec::with_capacity(lua_args.len());
                for arg in lua_args {
                    match ottavino_value_to_js(&env, ctx, &mut dummy_handles, arg) {
                        Ok(u) => js_args.push(u.raw()),
                        Err(e) => {
                            let err_str = ctx.intern(e.reason.as_bytes());
                            return Err(ottavino::Error::from_value(
                                ottavino::Value::String(err_str),
                            ));
                        }
                    }
                }

                let mut raw_this = std::ptr::null_mut();
                unsafe {
                    napi::sys::napi_get_undefined(raw_env, &mut raw_this);
                }

                let mut raw_return = std::ptr::null_mut();
                let status = unsafe {
                    napi::sys::napi_call_function(
                        raw_env,
                        raw_this,
                        raw_func,
                        js_args.len(),
                        js_args.as_ptr(),
                        &mut raw_return,
                    )
                };

                if status == napi::sys::Status::napi_ok {
                    let js_return = unsafe { Unknown::from_napi_value(raw_env, raw_return) };
                    match js_return {
                        Ok(u) => match js_to_ottavino_value(&env, ctx, u) {
                            Ok(lua_val) => {
                                stack.replace(ctx, lua_val);
                                Ok(ottavino::CallbackReturn::Return)
                            }
                            Err(e) => {
                                let err_str = ctx.intern(e.reason.as_bytes());
                                Err(ottavino::Error::from_value(
                                    ottavino::Value::String(err_str),
                                ))
                            }
                        },
                        Err(e) => {
                            let err_str = ctx.intern(e.reason.as_bytes());
                            Err(ottavino::Error::from_value(
                                ottavino::Value::String(err_str),
                            ))
                        }
                    }
                } else {
                    let mut raw_err = std::ptr::null_mut();
                    unsafe {
                        napi::sys::napi_get_and_clear_last_exception(raw_env, &mut raw_err);
                    }
                    let err_str = if !raw_err.is_null() {
                        if let Ok(s) = unsafe { String::from_napi_value(raw_env, raw_err) } {
                            s
                        } else if let Ok(js_obj) = unsafe { Object::from_napi_value(raw_env, raw_err) } {
                            if let Ok(msg_val) = js_obj.get_named_property::<Unknown>("message") {
                                if let Ok(s) = unsafe { String::from_napi_value(raw_env, msg_val.raw()) } {
                                    s
                                } else {
                                    "Error in JS callback".to_string()
                                }
                            } else {
                                "Error in JS callback".to_string()
                            }
                        } else {
                            "Error in JS callback".to_string()
                        }
                    } else {
                        "Error in JS callback".to_string()
                    };

                    let interned = ctx.intern(err_str.as_bytes());
                    Err(ottavino::Error::from_value(
                        ottavino::Value::String(interned),
                    ))
                }
            });

            if let Err(e) = ctx
                .globals()
                .set(ctx, key, ottavino::Value::Function(lua_cb.into()))
            {
                set_result = Err(NapiError::from_reason(e.to_string()));
            }
        });

        set_result
    }

    /// Read a field from a table handle.
    #[napi]
    pub fn table_get<'js>(
        &mut self,
        env: &'js Env,
        table: &LuaTable,
        key: Unknown<'js>,
    ) -> Result<Unknown<'js>, NapiError> {
        let Lua { inner, handles } = self;
        let mut result: Result<Unknown<'js>, NapiError> =
            Err(NapiError::from_reason("table_get failed"));

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles[table.id]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match js_to_ottavino_value(env, ctx, key) {
                Ok(k) => {
                    let v = t.get_value(ctx, k);
                    result = ottavino_value_to_js(env, ctx, handles, v);
                }
                Err(e) => result = Err(e),
            }
        });

        result
    }

    /// Write a field on a table handle.
    #[napi]
    pub fn table_set(
        &mut self,
        env: &Env,
        table: &LuaTable,
        key: Unknown,
        value: Unknown,
    ) -> Result<(), NapiError> {
        let Lua { inner, handles } = self;
        let mut result: Result<(), NapiError> = Ok(());

        inner.enter(|ctx| {
            let val = ctx.fetch(&handles[table.id]);
            let ottavino::Value::Table(t) = val else {
                result = Err(NapiError::from_reason("handle is not a table"));
                return;
            };
            match (
                js_to_ottavino_value(env, ctx, key),
                js_to_ottavino_value(env, ctx, value),
            ) {
                (Ok(k), Ok(v)) => {
                    if let Err(e) = t.set(ctx, k, v) {
                        result = Err(NapiError::from_reason(e.to_string()));
                    }
                }
                (Err(e), _) | (_, Err(e)) => result = Err(e),
            }
        });

        result
    }
}

fn thread_mode_str(m: ThreadMode) -> String {
    match m {
        ThreadMode::Stopped => "stopped",
        ThreadMode::Result => "result",
        ThreadMode::Normal => "normal",
        ThreadMode::Suspended => "suspended",
        ThreadMode::Waiting => "waiting",
        ThreadMode::Running => "running",
    }
    .to_string()
}

/// Wrap a handle struct into an `Unknown` JS value.
fn handle_to_unknown<'js, T: ToNapiValue>(
    env: &'js Env,
    h: T,
) -> Result<Unknown<'js>, NapiError> {
    let raw_env = env.raw();
    let raw_val = unsafe { T::to_napi_value(raw_env, h)? };
    Ok(unsafe { Unknown::from_napi_value(raw_env, raw_val)? })
}

fn ottavino_value_to_js<'js, 'gc>(
    env: &'js Env,
    ctx: ottavino::Context<'gc>,
    handles: &mut Vec<StashedValue>,
    val: ottavino::Value<'gc>,
) -> Result<Unknown<'js>, NapiError> {
    match val {
        ottavino::Value::Nil => ().into_unknown(env),
        ottavino::Value::Boolean(b) => b.into_unknown(env),
        ottavino::Value::Integer(i) => i.into_unknown(env),
        ottavino::Value::Number(n) => n.into_unknown(env),
        ottavino::Value::String(s) => {
            let str_val = String::from_utf8_lossy(s.as_bytes());
            env.create_string(&str_val)?.into_unknown(env)
        }
        ottavino::Value::Table(t) => {
            let len = t.length();
            if len > 0 {
                let mut js_arr = env.create_array(len as u32)?;
                for i in 1..=len {
                    let elem = t.get_value(ctx, i);
                    let js_elem = ottavino_value_to_js(env, ctx, handles, elem)?;
                    js_arr.set_element((i - 1) as u32, js_elem)?;
                }
                js_arr.into_unknown(env)
            } else {
                let mut js_obj = Object::new(env)?;
                for (k, v) in t.iter() {
                    let k_str = match k {
                        ottavino::Value::String(s) => {
                            String::from_utf8_lossy(s.as_bytes()).to_string()
                        }
                        ottavino::Value::Integer(i) => i.to_string(),
                        ottavino::Value::Number(n) => n.to_string(),
                        _ => continue,
                    };
                    let js_val = ottavino_value_to_js(env, ctx, handles, v)?;
                    js_obj.set_named_property(&k_str, js_val)?;
                }
                js_obj.into_unknown(env)
            }
        }
        ottavino::Value::Function(_) => {
            let id = handles.len();
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaFunction { id })
        }
        ottavino::Value::Thread(_) => {
            let id = handles.len();
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaThread { id })
        }
        ottavino::Value::UserData(_) => {
            let id = handles.len();
            handles.push(ctx.stash(val));
            handle_to_unknown(env, LuaUserData { id })
        }
    }
}

fn js_to_ottavino_value<'gc>(
    env: &Env,
    ctx: ottavino::Context<'gc>,
    js_val: Unknown,
) -> Result<ottavino::Value<'gc>, NapiError> {
    let value_type = js_val.get_type()?;
    match value_type {
        ValueType::Undefined | ValueType::Null => Ok(ottavino::Value::Nil),
        ValueType::Boolean => {
            let b = unsafe { bool::from_napi_value(env.raw(), js_val.raw())? };
            Ok(ottavino::Value::Boolean(b))
        }
        ValueType::Number => {
            let n = unsafe { f64::from_napi_value(env.raw(), js_val.raw())? };
            if n.fract() == 0.0 && n >= (i64::MIN as f64) && n <= (i64::MAX as f64) {
                Ok(ottavino::Value::Integer(n as i64))
            } else {
                Ok(ottavino::Value::Number(n))
            }
        }
        ValueType::String => {
            let s = unsafe { String::from_napi_value(env.raw(), js_val.raw())? };
            let interned = ctx.intern(s.as_bytes());
            Ok(ottavino::Value::String(interned))
        }
        ValueType::Object => {
            if js_val.is_array()? {
                let js_arr = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let len = js_arr.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let elem: Unknown = js_arr.get_element(i)?;
                    let lua_elem = js_to_ottavino_value(env, ctx, elem)?;
                    table
                        .set(ctx, (i + 1) as i64, lua_elem)
                        .map_err(|e| NapiError::from_reason(e.to_string()))?;
                }
                Ok(ottavino::Value::Table(table))
            } else {
                let js_obj = unsafe { Object::from_napi_value(env.raw(), js_val.raw())? };
                let names = js_obj.get_property_names()?;
                let len = names.get_array_length()?;
                let table = ottavino::Table::new(&ctx);
                for i in 0..len {
                    let prop_name: String = names.get_element(i)?;
                    let prop_val: Unknown =
                        js_obj.get_property(names.get_element::<Unknown>(i)?)?;
                    let lua_val = js_to_ottavino_value(env, ctx, prop_val)?;
                    let interned_key = ctx.intern(prop_name.as_bytes());
                    table
                        .set(ctx, interned_key, lua_val)
                        .map_err(|e| NapiError::from_reason(e.to_string()))?;
                }
                Ok(ottavino::Value::Table(table))
            }
        }
        _ => Ok(ottavino::Value::Nil),
    }
}
