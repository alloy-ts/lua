# Ottavino & NAPI Binding API Reference

This document details the underlying **Ottavino (Piccolo VM fork)** Rust API and maps it to the **NAPI JavaScript/TypeScript bindings** exposed by `@alloy-ts/lua`.

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
+-------------------------------------------------------------+
                              |
                              v  (Safe GC Arena & VM Execution)
+-------------------------------------------------------------+
|                     Ottavino Rust VM                        |
|            (pure Rust Lua 5.4 VM using gc-arena)            |
+-------------------------------------------------------------+
```

---

## 1. Ottavino Rust VM API vs. NAPI Bindings Summary

The table below outlines the core capabilities of the underlying `ottavino` Rust crate and how they are exposed through the NAPI binding in `src/lua.rs`:

| Category | Ottavino Rust Crate API | NAPI Exposed JS/TS API (`@alloy-ts/lua`) | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Instance Creation** | `ottavino::Lua::full()`, `ottavino::Lua::core()`, `ottavino::Lua::empty()` | `Lua.full()`, `Lua.core()`, `Lua.empty()`, `new Lua()` | **Fully Covered** |
| **Library Loading** | `load_core()`, `load_io()` | `lua.loadCore()`, `lua.loadIo()` | **Fully Covered** |
| **Code Execution** | `enter(...)`, `Closure::load`, `Executor::start`, `finish(&stashed)` | `lua.eval(code: string): unknown` | **Fully Covered** |
| **Global State** | `ctx.globals().get_raw(...)`, `ctx.globals().set(...)` | `lua.getGlobal(name: string): unknown`<br>`lua.setGlobal(name: string, value: unknown)` | **Fully Covered** |
| **GC & Memory** | `total_memory()`, `gc_collect()`, `gc_metrics()` | `lua.totalMemory(): number`<br>`lua.gcCollect(): void`<br>`lua.gcMetrics(): GcMetrics` | **Fully Covered** |
| **Value Conversion** | `Value` enum (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`) | Automatic JS type conversion (`undefined`/`null`, `boolean`, `number`, `string`, `Array`, `Object`) | **Fully Covered** |
| **Custom Callbacks** | `Callback::from_fn(...)` | *Internal Rust VM capability* | Indirectly accessible via `eval` and standard libraries |
| **Symmetric Coroutines**| Built-in `coroutine.yieldto` | Available in Lua script execution (`lua.eval`) | **Supported in Lua Scripts** |
| **Fuel & Stepping** | `Executor::step(ctx, fuel)` | Handled synchronously by `finish()` in `eval` | Bounded execution within NAPI `eval` |

---

## 2. Exposed JavaScript/TypeScript API (`@alloy-ts/lua`)

### Constructors and Factories

- **`new Lua()` / `Lua.full()`**
  Creates a new Lua instance with the full standard library loaded (base, coroutine, math, string, table, I/O).

- **`Lua.core()`**
  Creates a sandboxed Lua instance with core standard libraries loaded (base, coroutine, math, string, table), omitting I/O capabilities.

- **`Lua.empty()`**
  Creates an isolated Lua instance with no standard libraries pre-loaded.

---

### Evaluation and Globals

- **`lua.eval(code: string): unknown`**
  Compiles and executes the provided Lua code string.
  - Returns converted JavaScript primitive, object, or array values.
  - Throws descriptive errors for compilation or runtime failures.

- **`lua.setGlobal(name: string, value: unknown): void`**
  Binds a JavaScript value into Lua's global `_G` table.
  - JS `string`, `number` (integer/float), `boolean`, `null`/`undefined` map to corresponding Lua types.
  - Plain JS `Object` maps to a keyed Lua `table`.
  - JS `Array` maps to a 1-indexed sequential Lua `table`.

- **`lua.getGlobal(name: string): unknown`**
  Retrieves a global variable from the Lua VM environment, converting it back to JavaScript primitives, plain objects, or arrays.

---

### Standard Library Loading

- **`lua.loadCore(): void`**
  Loads core standard libraries into an existing Lua state on demand.

- **`lua.loadIo(): void`**
  Loads the I/O standard library into an existing Lua state on demand.

---

### Memory & Garbage Collection Controls

- **`lua.totalMemory(): number`**
  Returns the total memory allocated by the Lua VM in bytes.

- **`lua.gcCollect(): void`**
  Triggers a full garbage collection cycle within the underlying `gc-arena`.

- **`lua.gcMetrics(): GcMetrics`**
  Returns a snapshot object containing GC metrics:
  - `totalAllocation: number`: Total tracked byte allocation.
  - `allocationDebt: number`: Current allocation debt tracked by `gc-arena`.

---

## 3. Type Conversion Matrix

| Lua Type | JavaScript / TypeScript Type | Direction |
| :--- | :--- | :--- |
| `nil` | `undefined` | Lua -> JS |
| `undefined` / `null` | `nil` | JS -> Lua |
| `boolean` | `boolean` | Bidirectional |
| `integer` / `float` | `number` | Bidirectional |
| `string` | `string` | Bidirectional |
| Keyed `table` | Plain `Object` (`{ [key: string]: unknown }`) | Bidirectional |
| Sequential `table` | `Array` (`Array<unknown>`) | Bidirectional |
| `function` | `"[lua function]"` | Placeholder string |
| `thread` | `"[lua thread]"` | Placeholder string |
| `userdata` | `"[lua userdata]"` | Placeholder string |
