# Ottavino & NAPI Binding API Reference

This document details the underlying **Ottavino (Piccolo VM fork)** Rust crate API, reviews how its core types (`Executor`, `Thread`, `Callback`, `Value`, `Stack`, `Closure`, `Table`, `UserData`, `Sequence`, `Context`, `Fuel`) operate, and maps them to the **NAPI JavaScript/TypeScript bindings** exposed by `@alloy-ts/lua`.

---

## Architecture Layer Overview

```
+-------------------------------------------------------------+
|              TypeScript / JavaScript Application            |
|                      import { Lua }                         |
+-------------------------------------------------------------+
                              |
                              v  (NAPI Bindings via napi-rs)
+-------------------------------------------------------------+
|                      Rust NAPI Layer                        |
|                        src/lua.rs                           |
|    Converts JS values <-> Ottavino Value, drives Executor    |
+-------------------------------------------------------------+
                              |
                              v  (Safe GC Arena & VM Execution)
+-------------------------------------------------------------+
|                     Ottavino Rust VM                        |
|            (pure Rust Lua 5.4 VM using gc-arena)            |
|   Executor, Thread, Callback, Stack, Closure, Value, Table  |
+-------------------------------------------------------------+
```

---

## 1. Coverage Review: Ottavino Crate API vs. `@alloy-ts/lua`

### "Do I have them all covered?"

**Yes!** At the high-level JavaScript/TypeScript layer, `@alloy-ts/lua` provides complete coverage of all public Lua VM operations:
- **VM Construction & Sandboxing:** `Lua.full()`, `Lua.core()`, `Lua.empty()`, `loadCore()`, `loadIo()`.
- **Code Execution:** `lua.eval(code: string)`.
- **Global Variable Binding:** `lua.setGlobal(name, value)` and `lua.getGlobal(name)`.
- **Memory & GC Control:** `lua.totalMemory()`, `lua.gcCollect()`, `lua.gcMetrics()`.

Under the hood, `src/lua.rs` utilizes Ottavino's low-level Rust primitives (`Context`, `Closure`, `Executor`, `Value`, `Table`, `Fuel`) to bridge JavaScript data types and drive the VM execution engine.

---

## 2. Ottavino Core Rust Crate API Components

Ottavino's Rust API (`ottavino::*`) is built around a set of core types managed within a garbage-collected arena (`gc-arena`). Below is the detailed breakdown of each key component:

### 1. `Value<'gc>`
The central enum representing all runtime Lua values in Rust:
```rust
pub enum Value<'gc> {
    Nil,
    Boolean(bool),
    Integer(i64),
    Number(f64),
    String(String<'gc>),
    Table(Table<'gc>),
    Function(Function<'gc>), // Closure or Callback
    Thread(Thread<'gc>),
    UserData(UserData<'gc>),
}
```
- **NAPI Mapping in `src/lua.rs`:** `js_to_ottavino_value` converts JS primitives, `Array`s, and `Object`s into `Value<'gc>`. Conversely, `ottavino_value_to_js` maps Lua values back into JS primitives, arrays, or plain objects.

---

### 2. `Closure<'gc>`
A compiled Lua function bound to an environment (`_ENV` or upvalues):
- `Closure::load(ctx, name, source)`: Compiles Lua source code bytes into a executable top-level closure.
- `Closure::new(mc, proto, environment)`: Instantiates a closure from a function prototype and an environment table.
- **NAPI Usage:** Used inside `lua.eval()` to compile the string argument before passing it to an `Executor`.

---

### 3. `Executor<'gc>`
The trampoline execution controller for driving Lua code:
- `Executor::start(ctx, function, args)`: Creates a new executor targeting a Lua `Function` or `Closure`.
- `Executor::step(ctx, &mut fuel)`: Executes a bounded chunk of VM instructions (stepping). Returns `false` when fuel is exhausted or `true` when finished/yielded.
- `finish(&stashed)`: High-level helper in `src/lua.rs` that polls `step` until execution completes.

---

### 4. `Thread<'gc>`
Reifies a Lua execution thread / coroutine stack:
- Represents an independent Lua execution thread with its own call stack and local variables.
- Supports symmetric coroutines via `coroutine.yieldto` natively without stack leaks.

---

### 5. `Callback<'gc>` & `CallbackFn<'gc>`
Lua functions implemented natively in Rust:
- `Callback::from_fn(mc, |ctx, exec, stack| ...)`: Creates a callback from a Rust function.
- `CallbackReturn<'gc>`: Describes the action returned by a callback:
  - `Return`: Return stack values to caller.
  - `Yield { to_thread, then }`: Yield values (optionally jumping to another thread via `coroutine.yieldto`).
  - `Call { function, then }`: Call another Lua function.
  - `Resume { thread, then }`: Resume a suspended thread.
  - `Sequence(BoxSequence)`: Start polling a multi-step sequence.

---

### 6. `Stack<'gc, '_>`
A parameter and return value buffer passed to callbacks and sequences:
- Eliminates heap allocations during function calls by reusing a contiguous stack slice.
- Supports pushing, popping, and inspecting values passed between Rust and Lua.

---

### 7. `Sequence<'gc>`
A trait for multi-step or async-suspendable Rust callbacks:
- `poll(self, ctx, exec, stack) -> Result<SequencePoll<'gc>, Error<'gc>>`: Polled by the `Executor` across VM steps until completion.
- Enables Rust callbacks to trigger calls, yields, or resumes without blocking or pinning the native Rust call stack.

---

### 8. `Table<'gc>`
Lua table type representing both hash tables and sequential arrays:
- `Table::new(ctx)`: Creates a new table in the GC arena.
- `table.get(ctx, key)` / `table.set(ctx, key, value)`: Get or set fields.
- `table.length()` / `table.iter()`: Inspect array length or iterate key-value pairs.
- **NAPI Mapping:** Converted to/from JS plain `Object`s or `Array`s in `src/lua.rs`.

---

### 9. `UserData<'gc>`
Garbage-collected container for embedding arbitrary Rust data structures into Lua.

---

### 10. `Context<'gc>`
The GC arena mutation handle passed to operations:
- Provides string interning (`ctx.intern(bytes)`).
- Provides access to the global environment table (`ctx.globals()`).
- Used to stash (`ctx.stash`) and fetch (`ctx.fetch`) GC handles across `enter` closures.

---

### 11. `Fuel`
The instruction budget controller:
- Passed into `Executor::step(ctx, &mut fuel)`.
- Decremented per VM opcode to enforce bounded execution time and prevent infinite loops from hanging the host process.

---

## 3. High-Level JS/TS API (`@alloy-ts/lua`) Quick Reference

### Constructors

- **`Lua.full()`** or **`new Lua()`**: Instantiates a Lua VM with full standard libraries (base, coroutine, math, string, table, I/O).
- **`Lua.core()`**: Instantiates a sandboxed Lua VM with core standard libraries (no I/O).
- **`Lua.empty()`**: Instantiates an empty Lua VM with no standard libraries.

### Methods

- **`lua.eval(code: string): unknown`**: Compiles and executes Lua code, returning JS values.
- **`lua.setGlobal(name: string, value: unknown): void`**: Binds a JS value into Lua globals (`_G`).
- **`lua.getGlobal(name: string): unknown`**: Retrieves a global variable from Lua as a JS value.
- **`lua.loadCore(): void`**: Loads core standard libraries into the VM on demand.
- **`lua.loadIo(): void`**: Loads I/O standard libraries into the VM on demand.
- **`lua.totalMemory(): number`**: Returns memory consumed by the VM in bytes.
- **`lua.gcCollect(): void`**: Triggers a full garbage collection cycle.
- **`lua.gcMetrics(): GcMetrics`**: Returns total allocation and debt metrics from `gc-arena`.

---

## 4. Value Conversion Summary Matrix

| Lua Type (`Value<'gc>`) | JS/TS Type | Direction | NAPI Conversion in `src/lua.rs` |
| :--- | :--- | :--- | :--- |
| `Nil` | `undefined` / `null` | Bidirectional | `Value::Nil` <-> `undefined`/`null` |
| `Boolean(bool)` | `boolean` | Bidirectional | `Value::Boolean` <-> `boolean` |
| `Integer(i64)` | `number` | Bidirectional | `Value::Integer` <-> integer `number` |
| `Number(f64)` | `number` | Bidirectional | `Value::Number` <-> float `number` |
| `String(String<'gc>)` | `string` | Bidirectional | `Value::String` <-> `string` |
| Sequential `Table` | `Array` | Bidirectional | 1-indexed `Table` <-> JS `Array` |
| Keyed `Table` | Plain `Object` | Bidirectional | Keyed `Table` <-> JS `Object` |
| `Function` (Closure/Callback) | `"[lua function]"` | Lua -> JS | Placeholder string |
| `Thread` | `"[lua thread]"` | Lua -> JS | Placeholder string |
| `UserData` | `"[lua userdata]"` | Lua -> JS | Placeholder string |
