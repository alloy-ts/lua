# Ottavino Architecture & NAPI Bindings Overview

This document provides an overview of the architecture of the underlying `ottavino` Lua VM, its stackless design, and how its capabilities are exposed to TypeScript and JavaScript via NAPI-RS bindings.

---

## The Stackless Interpreter Architecture

`ottavino` is an embedded Lua 5.4 interpreter written in pure Rust using `gc-arena` for garbage collection. Rather than relying on the native C or Rust function call stack, `ottavino` employs a **stackless (trampoline-based)** interpreter design.

### Key Architectural Concepts

1. **Stackless VM Execution**
   - In `ottavino`, execution state is reified into an `Executor` struct inside `gc-arena`.
   - The VM does not recurse on the Rust stack during nested Lua function or callback calls. Instead, execution is driven by repeatedly stepping the executor (`Executor::step`).

2. **Fuel and Bounded Stepping**
   - Every VM step consumes a unit of **fuel**.
   - `Executor::step` runs VM instructions until its fuel limit is reached, ensuring that execution always returns in bounded time.
   - This prevents infinite loops in untrusted Lua code from freezing the host process.

3. **Garbage Collection (`gc-arena`)**
   - Memory management uses tracing garbage collection via `gc-arena`.
   - `gc-arena` uses a **Mutation XOR Collection** rule: garbage collection takes place between stepping calls when no Rust pointers are borrowed inside the arena.

4. **Coroutines & Symmetric `coroutine.yieldto`**
   - Lua coroutines (`coroutine.create`, `coroutine.resume`, `coroutine.yield`) are supported.
   - Because of the stackless trampoline design, `ottavino` also supports symmetric coroutine transfers via `coroutine.yieldto(targetThread)`, yielding directly from one thread to another without accumulating stack frames.

---

## Covered NAPI Bindings

Our native module exports NAPI bindings in `src/lua.rs` that wrap `ottavino` for Node.js / TypeScript.

### 1. Environment Factories

- `Lua.empty()`: Instantiates an environment without standard library modules.
- `Lua.core()`: Instantiates an environment with core non-I/O modules (`base`, `coroutine`, `math`, `string`, `table`).
- `Lua.full()`: Instantiates an environment with all standard library modules loaded (including I/O).

### 2. Variable & State Injection

- `lua.setGlobal(key, value)`: Interns key and value strings into the Lua global table environment (`ctx.globals()`).

### 3. Expression Evaluation

- `lua.eval(code)`: Compiles the source string into a top-level closure (`Closure::load`), creates an `Executor`, steps it to completion (`Lua::finish`), and extracts the result value (`take_result`).

### 4. Memory & Garbage Collection Management

- `lua.totalMemory()`: Returns current memory allocated in bytes (`total_memory`).
- `lua.gcCollect()`: Triggers a complete garbage collection cycle (`gc_collect`).
- `lua.gcMetrics()`: Returns allocator total bytes and allocation debt (`gc_metrics`).
