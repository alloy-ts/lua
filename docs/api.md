# `@alloy-ts/lua` API Reference & Ottavino Architecture Mapping

The `@alloy-ts/lua` library exposes native Node.js/TypeScript bindings for the [Ottavino](https://github.com/kyren/ottavino) pure-Rust Lua 5.4 Virtual Machine via [NAPI-RS](https://napi.rs/).

---

## Table of Contents

- [1. TypeScript/JavaScript Public API](#1-typescriptjavascript-public-api)
  - [Constructors & Static Factory Methods](#constructors--static-factory-methods)
  - [Code Execution](#code-execution)
  - [Global Variable Management (`lua.globals()`)](#global-variable-management-luaglobals)
  - [Standard Library Management](#standard-library-management)
  - [Memory & Garbage Collection](#memory--garbage-collection)
- [2. Type Conversions (JS ↔ Lua)](#2-type-conversions-js--lua)
- [3. Ottavino Rust Crate API Mapping](#3-ottavino-rust-crate-api-mapping)
  - [Ottavino Core Types & NAPI Mapping Table](#ottavino-core-types--napi-mapping-table)
  - [Detailed Breakdown of Ottavino Internal Types](#detailed-breakdown-of-ottavino-internal-types)

---

## 1. TypeScript/JavaScript Public API

### Constructors & Static Factory Methods

#### `new Lua()`

- **Returns**: `Lua`
- Instantiates a new Lua VM with the full standard library loaded (`base`, `coroutine`, `math`, `string`, `table`, `io`).

#### `Lua.full(): Lua`

- **Returns**: `Lua`
- Factory method that instantiates a Lua VM with the full standard library loaded.

#### `Lua.core(): Lua`

- **Returns**: `Lua`
- Factory method that instantiates a Lua VM with core standard libraries loaded (`base`, `coroutine`, `math`, `string`, `table`), excluding `io`.

#### `Lua.empty(): Lua`

- **Returns**: `Lua`
- Factory method that instantiates a bare Lua VM with no standard libraries loaded.

---

### Code Execution

#### `lua.eval(code: string): unknown`

Compiles and executes a Lua code string, returning the resulting value as a JavaScript value.

- **Parameters**: `code` (`string`) — Lua code string to execute.
- **Returns**: `unknown` — Evaluated result converted to JavaScript primitives/objects.
- **Throws**:
  - `Lua compile error: ...` if compilation fails.
  - `Lua runtime error: ...` if execution fails during VM run.

---

### Global Variable Management (`lua.globals()`)

`lua.globals()` returns a `Globals` handle for interacting with global variables (`_ENV` / `ctx.globals()`), mirroring Ottavino's Rust API.

#### `lua.globals(): Globals`

- **Returns**: `Globals` — Interface providing `.get()` and `.set()` methods for environment variables.

#### `globals.set(name: string, value: unknown): void`

Binds a global variable in the Lua environment.

- **Parameters**:
  - `name` (`string`) — Global variable name.
  - `value` (`unknown`) — JS primitive or object value converted to Lua.
- **Under the Hood**:
  Executes `ctx.globals().set(ctx, key, lua_val)` on Ottavino's `Table` handle inside `self.inner.enter()`. Converts JS primitives, objects/arrays to Lua tables, and JS functions to callable Ottavino `Callback`s.

#### `globals.get(name: string): unknown`

Retrieves a global variable from the Lua environment.

- **Parameters**: `name` (`string`) — Global variable name.
- **Returns**: `unknown` — Value converted from Lua to JavaScript (or `undefined` if unset/`nil`).
- **Under the Hood**:
  Executes `ctx.globals().get_raw(ottavino::Value::String(key))` on Ottavino's `Table` handle inside `self.inner.enter()`.

---

### Standard Library Management

#### `lua.loadCore(): void`

Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua state.

#### `lua.loadIo(): void`

Loads the `io` (I/O) standard library into an existing Lua state.

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`

Returns total memory tracked by the Lua VM allocator in bytes.

- **Returns**: `number` — Memory consumption in bytes.

#### `lua.gcCollect(): void`

Triggers a manual full garbage collection cycle inside the Lua VM.

#### `lua.gcMetrics(): GcMetrics`

Retrieves a snapshot of garbage collector metrics.

- **Returns**: `GcMetrics` (`{ totalAllocation: number, allocationDebt: number }`).

---

## 2. Type Conversions (JS ↔ Lua)

### JS to Lua (`globals.set`)

- `undefined` / `null` → `nil`
- `boolean` → `boolean`
- `number` (integer) → `integer`
- `number` (float) → `number` (float)
- `string` → `string`
- `Array` → Sequential 1-indexed `table`
- Plain `Object` → Keyed `table`

### Lua to JS (`eval` / `globals.get`)

- `nil` → `undefined`
- `boolean` → `boolean`
- `integer` → `number`
- `float` → `number`
- `string` → `string`
- `table` (sequential / length > 0) → `Array`
- `table` (keyed / empty) → `Object`
- `function` → `"[lua function]"` (placeholder string)
- `thread` → `"[lua thread]"` (placeholder string)
- `userdata` → `"[lua userdata]"` (placeholder string)

---

## 3. Ottavino Rust Crate API Mapping

The table below maps the internal types and mechanisms provided by the **Ottavino** Rust crate (`ottavino::*`) to how `@alloy-ts/lua` handles them over the NAPI boundary:

### Ottavino Core Types & NAPI Mapping Table

| Ottavino Rust Crate Type  | Description                                                                                                                           | `@alloy-ts/lua` NAPI TS Binding Mapping                                                                                                       |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `ottavino::Value<'gc>`    | Single enum representing all Lua values (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). | Automatically converted to JS primitives, objects, arrays, or placeholder strings (`"[lua function]"`, `"[lua thread]"`, `"[lua userdata]"`). |
| `ottavino::Table<'gc>`    | Heterogeneous table storing keyed/sequential elements.                                                                                | Converted recursively from/to JS `Object` and JS `Array`. Accessed via `ctx.globals()`.                                                       |
| `ottavino::Closure<'gc>`  | Compiled Lua bytecode function closure.                                                                                               | Compiled via `Closure::load` inside `lua.eval()`.                                                                                             |
| `ottavino::Callback<'gc>` | Native Rust callback function exposed to Lua (`Callback::from_fn`).                                                                   | Internal stdlib callbacks registered inside Ottavino.                                                                                         |
| `ottavino::Function<'gc>` | Enum over `Closure` or `Callback`.                                                                                                    | Surfaced in TS as `"[lua function]"`.                                                                                                         |
| `ottavino::Executor<'gc>` | VM execution state for invoking closures/threads.                                                                                     | Started via `Executor::start(ctx, closure, ())` and driven to completion via `self.inner.finish(&stashed)` in `lua.eval()`.                   |
| `ottavino::Thread<'gc>`   | Coroutine execution context / thread.                                                                                                 | Surfaced in TS as `"[lua thread]"`.                                                                                                           |
| `ottavino::UserData<'gc>` | Custom Rust data registered with GC arena.                                                                                            | Surfaced in TS as `"[lua userdata]"`.                                                                                                         |
| `ottavino::Stash`         | Rooted handle for preserving GC objects across VM entries.                                                                            | Used in `self.inner.enter(...)` and `self.inner.finish(...)` to safely hold executor instances across NAPI boundaries.                        |
| `ottavino::Context<'gc>`  | Garbage-collected lifetime handle for VM operations.                                                                                  | Passed into closures inside `self.inner.enter(                                                                                                | ctx | ...)` for interning strings and allocating tables (`ctx.globals()`). |

---

### Detailed Breakdown of Ottavino Internal Types

1. **`Value<'gc>` Enum**:
   Ottavino defines `pub enum Value<'gc>` with variants `Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, and `UserData`. `@alloy-ts/lua` matches against this enum in `ottavino_value_to_js()` in `src/lua.rs`.

2. **`Executor` & `Closure`**:
   Evaluating Lua strings in `lua.eval()` compiles code into an `ottavino::Closure`, wraps it in an `ottavino::Executor`, stashes it using `ctx.stash()`, and executes it with `self.inner.finish(&stashed)`.

3. **Globals & `Table`**:
   `lua.globals()` mirrors `ctx.globals()` in Ottavino, which returns the global environment table `_ENV` (`_G`). Calling `lua.globals().set(...)` invokes `ctx.globals().set(ctx, key, lua_val)` in Rust; calling `lua.globals().get(...)` invokes `ctx.globals().get_raw(...)`.
