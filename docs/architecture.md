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

| NAPI Method / Type                            | Description                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `Lua.full()`, `core()`, `empty()`             | VM state constructors with configurable stdlib loading.                    |
| `eval(code)`                                  | Compiles and steps code in the stackless `Executor` to completion.         |
| `setGlobal(name, val)`                        | Marshals JS values/objects/arrays into Ottavino `Table` and `Value` types. |
| `getGlobal(name)`                             | Retrieves global `Value` and converts it to JS primitives or objects.      |
| `totalMemory()`, `gcCollect()`, `gcMetrics()` | Exposes `gc-arena` memory tracking and manual GC invocation to JS.         |
