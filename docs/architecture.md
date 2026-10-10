# `@alloy-ts/lua` Architecture & VM Design Guide

This document details the underlying virtual machine architecture of **Ottavino** (derived from **Piccolo** and `gc-arena`), how its "stackless" design works, and how the **NAPI** binding layer exposes it to Node.js/TypeScript.

---

## 1. Overview of Ottavino / Piccolo & `gc-arena`

`@alloy-ts/lua` embeds **Ottavino** (a pure Rust VM for Lua 5.4 forked from Piccolo).

Key properties:

- **100% Pure Safe Rust:** Runs without native C libraries (`liblua`), avoiding C-stack buffer overflows, dangling pointers, or memory safety issues.
- **`gc-arena` Integration:** Uses an incremental mark-and-sweep garbage collector designed specifically for Rust.
- **"Mutation XOR Collection":** `gc-arena` requires that code accessing garbage-collected objects does so inside mutation methods (`Arena::mutate`). Collection only occurs when no mutation closures are executing on the Rust call stack.

---

## 2. A "Stackless" Interpreter Design

In standard PUC-Rio C Lua, executing Lua code relies on the C function call stack (`luaV_execute` calling C callbacks, which call `lua_call`, which call `luaV_execute` again).

Ottavino is **stackless** (trampoline-style VM):

- The Lua VM execution state is reified into an `Executor` object on the heap.
- Execution does not rely on the Rust function call stack.
- Long-running execution is driven by polling (`Executor::step(fuel)`), similar to how Rust `Future::poll()` works.

---

## 3. Benefits of Stackless Interpreter Design

### 3.1 Instant Cancellation

Because execution is driven from the outside by stepping the `Executor`, a running script can be instantly canceled or interrupted simply by stopping calls to `step()` and dropping the executor. No thread kill signals or native C longjmps are needed.

### 3.2 Pre-emptive Concurrency

Multiple independent Lua scripts (`Executor` tasklets) can be round-robin scheduled on the same thread. By stepping each `Executor` for a fixed amount of "fuel" (instruction count limit), Lua scripts gain pre-emptive multitasking without needing explicit cooperative yields.

### 3.3 Fuel, Pacing, and Custom Scheduling

- `Executor::step(fuel)` accepts a `Fuel` budget representing VM instructions to execute.
- Callbacks and long-running operations consume fuel or trigger fuel interrupts (`Fuel::interrupt`).
- Host applications can implement custom schedulers (e.g. rate-limiting, burst fuel allocation, or per-frame time-slicing).

### 3.4 Symmetric Coroutines and `coroutine.yieldto`

Standard Lua coroutines are **asymmetric** (yielding only back to their caller).
In a stackless interpreter, control jumps back up to the `Executor` trampoline. This allows Ottavino to natively support **symmetric coroutines** with `coroutine.yieldto(target_co, ...)`:

- `coroutine.yieldto` transfers control directly to another target coroutine without accumulating stack frames or causing stack leaks.
- `coroutine.continue(co)` resumes a suspended coroutine.

---

## 4. The "Big Lie" & C Stack Limits

Why can't standard PUC-Rio C Lua do full stackless execution?

In C Lua:

- Calling `lua_yield()` performs a C `longjmp`, which pops C call frames.
- When C callbacks call Lua (e.g. `table.sort` calling a Lua comparator), a Lua $\rightarrow$ C $\rightarrow$ Lua sandwich is created.
- Calling `lua_yield()` inside a C callback causes a runtime error because popping C stack frames destroys C execution state.
- While C Lua provides `lua_callk` / `lua_pcallk` continuations, re-writing C code to use continuations is manually onerous.

Ottavino solves this by reifying all Lua and callback execution state into heap-allocated state machines, enabling arbitrary suspend/resume across any depth of Lua $\leftrightarrow$ Rust execution.

---

## 5. Rust Coroutines, Lua Coroutines, and Snarfing

- **Snarfing:** Incorporating features from a host language directly into an embedded language VM (e.g., using host GC or host green threads).
- In Ottavino, Lua coroutines and callbacks use state machine polling similar to Rust `Future`/`Coroutine` traits.
- This design bridges Rust's async task model and Lua's coroutines cleanly across the NAPI layer.

---

## 6. NAPI Binding Layer Coverage

The `@alloy-ts/lua` NAPI layer exposes the Ottavino VM to TypeScript:

```
+-------------------------------------------------------+
|  TypeScript / JavaScript Application                   |
+-------------------------------------------------------+
                           |
                     NAPI Boundary
                           |
+-------------------------------------------------------+
|  NAPI Rust Binding Layer (src/lua.rs)                 |
|  - eval(code) -> Unknown                              |
|  - setGlobal(name, val) / getGlobal(name)             |
|  - totalMemory() / gcCollect() / gcMetrics()          |
+-------------------------------------------------------+
                           |
+-------------------------------------------------------+
|  Ottavino Pure-Rust Lua 5.4 VM Engine                 |
|  - Stackless Trampoline Executor                       |
|  - gc-arena Garbage Collector                          |
|  - Symmetric Coroutines (yieldto / continue)           |
+-------------------------------------------------------+
```

| NAPI Method / Type                            | Status      | Description                                                                                          |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `Lua.full()`, `core()`, `empty()`             | Implemented | VM state constructors with configurable stdlib loading.                                              |
| `lua.globals()` (`Globals` handle)            | Implemented | Accesses global `_ENV` table (`get`, `set`) mirroring Ottavino API.                                  |
| `eval(code)`                                  | Implemented | Compiles source into a `Closure<'gc>` and steps `Executor` to completion.                            |
| `setGlobal(name, val)` / `getGlobal(name)`    | Implemented | Convenience shortcuts delegating to `globals()`.                                                     |
| JS Function Callbacks (`Callback::from_fn`)   | Implemented | Converts JS functions into `ottavino::Callback`, handling arguments, returns, and error propagation. |
| `totalMemory()`, `gcCollect()`, `gcMetrics()` | Implemented | Exposes `gc-arena` memory tracking and manual GC invocation to JS.                                   |

---

## 7. Host Callback Registration (`ottavino::Callback::from_fn`)

When passing a JavaScript function to `lua.globals().set("name", jsFn)` or `lua.setGlobal("name", jsFn)`:

- The function is wrapped inside `ottavino::Callback::from_fn(&ctx, move |ctx, _exec, mut stack| { ... })`.
- **Stack Parameter Conversion:** Arguments on `ottavino::Stack` are translated to `Unknown` JS values using `ottavino_value_to_js`.
- **JS Execution & Error Propagation:** The JS function is invoked. Any thrown JS exceptions are caught (`sys::napi_get_and_clear_last_exception`) and returned as `Err(ottavino::Error)` so Lua `pcall`/`xpcall` or host `eval` can handle them gracefully.
- **Return Values:** JS return values are converted to `ottavino::Value` and pushed back onto the stack via `stack.replace(ctx, ret_val)`.

---

## 8. Advanced Ottavino Capabilities & NAPI Surface Roadmap

Ottavino provides rich underlying Rust APIs that map directly to the NAPI layer:

### 8.1 Async / Fuel Stepping Execution (`Executor::step`)

- **Ottavino API:** `Executor::start(ctx, function, args)` and `executor.step(ctx, &mut fuel)`.
- **NAPI Surface:** Exposing `LuaExecutor` handles to JavaScript allowing `executor.step(fuel: number): boolean` calls. JS callers drive execution incrementally via `setInterval` or `requestAnimationFrame` and can cancel execution anytime by dropping the handle.

### 7.3 Coroutine & Thread API (`Thread<'gc>`)

- **Ottavino API:** `Thread<'gc>`, `coroutine.yieldto`, and `coroutine.continue`.
- **NAPI Surface:** Exposing `Thread` handles to JavaScript for inspecting thread status (`running`, `suspended`, `dead`) and triggering explicit thread resumption or yield switching from host JS code.

---

## 7. Ottavino `Closure<'gc>` Compilation Model

In Ottavino's Rust API, executable Lua functions are represented by `Closure<'gc>`:

- **`Closure<'gc>`**: A garbage-collected handle to a `FunctionPrototype<'gc>` bound to an environment table (upvalues such as `_ENV`).
- **`Closure::load(ctx, name, source)`**: Compiles Lua source bytes into a top-level `Closure<'gc>` using the VM's global table as `_ENV`.
- **`Closure::load_with_env(ctx, name, source, env_table)`**: Compiles Lua source using a custom environment table for strict sandboxing.
- **`StashedClosure`**: Implements `Stashable<'gc>` to allow references to closures to safely persist across `gc-arena` garbage collection cycles.
