# API Reference

This document provides a detailed reference for the exported `Lua` class, `Executor` class, types, exception conversion, and API coverage provided by the native NAPI module (`dist/index.js`).

## Exported Members

```ts
import { Lua, Executor, StepResult, GcMetrics, __napiBindingTarget } from "@lib/module";
```

---

## Class: `Lua`

The `Lua` class wraps an underlying `ottavino::Lua` instance, providing a safe, isolated Lua 5.4 execution environment inside a Rust GC arena.

### Constructors & Factories

#### `new Lua()` / `Lua.full()`

Instantiates a Lua VM with the full standard library loaded (`base`, `coroutine`, `math`, `string`, `table`, `io`).

#### `Lua.core(): Lua`

Instantiates a Lua VM with core standard libraries loaded (`base`, `coroutine`, `math`, `string`, `table` - no file I/O).

#### `Lua.empty(): Lua`

Instantiates a bare, empty Lua VM with no standard library modules loaded (for maximum sandboxing).

---

### Code Execution & Variables

#### `lua.eval(source: string): unknown`

Compiles and executes the given Lua code string to completion, returning the result as a JavaScript value.

- **Parameters**: `source` (string) - The Lua code to execute.
- **Returns**: `unknown` - The converted JavaScript value corresponding to the return value of the Lua script.
- **Throws**: JavaScript Error if the Lua code contains syntax errors or runtime exceptions.

#### `lua.registerCallback(name: string, callback: (...args: unknown[]) => unknown): void`

Registers a JavaScript host function as a callable Lua global function.

- **Parameters**:
  - `name` (string) - The global function name in Lua.
  - `callback` (function) - The JavaScript function to invoke when called from Lua.

#### `lua.executor(source: string): Executor`

Compiles Lua source code and returns a step-driven `Executor` handle for fuel-metered or cancellable execution.

#### `lua.setGlobal(name: string, value: unknown): void`

Sets a global variable in the Lua VM environment. Converts JavaScript primitives (`boolean`, `number`, `string`, `null`/`undefined`) and complex objects/arrays into corresponding Lua primitives and tables.

#### `lua.getGlobal(name: string): unknown`

Retrieves a global variable from the Lua VM environment as a converted JavaScript value.

---

### Exception Conversion & Error Propagation

Errors automatically convert across the NAPI language boundary:

1. **Lua Errors -> JS Exceptions**: Runtime errors (`error("msg")`) or syntax errors in `lua.eval()` are mapped to `napi::Error` and thrown as standard JavaScript exceptions.
2. **JS Callback Exceptions -> Lua Errors**: Exceptions thrown inside a registered `registerCallback` JS function are converted to `ottavino::RuntimeError` in Lua, which can be caught via Lua's `pcall()`.
3. **Unhandled Propagation**: Uncaught JS callback exceptions propagate back out through `lua.eval()` as a re-thrown JavaScript `Error`.

---

### Standard Library Management

#### `lua.loadCore(): void`

Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua state.

#### `lua.loadIo(): void`

Loads I/O standard libraries into an existing Lua state.

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`

Returns total memory used by the Lua VM in bytes (tracks all `Gc` arena memory).

#### `lua.gcCollect(): void`

Triggers a full garbage collection cycle in the underlying Lua VM arena.

#### `lua.gcMetrics(): GcMetrics`

Returns garbage collector metrics from the arena allocator.

---

## Class: `Executor`

Represents a suspended or running Lua execution state that can be stepped incrementally.

### Methods

#### `step(fuel: number): StepResult`

Executes Lua VM instructions up to `fuel` budget steps.

- **Parameters**: `fuel` (number) - Maximum VM instruction budget.
- **Returns**: `StepResult` - `{ done: boolean, result?: unknown }`.

---

## Interfaces

```ts
export interface StepResult {
  done: boolean;
  result?: unknown;
}

export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt triggering collector cycles. */
  allocationDebt: number;
}
```

---

## Ottavino Crate API Coverage Summary

| Ottavino Crate API                   | NAPI Exported Binding                    | Coverage Status |
| :----------------------------------- | :--------------------------------------- | :-------------- |
| `OLua::full()` / `OLua::default()`   | `new Lua()` / `Lua.full()`               | ✅ Covered      |
| `OLua::core()`                       | `Lua.core()`                             | ✅ Covered      |
| `OLua::empty()`                      | `Lua.empty()`                            | ✅ Covered      |
| `OLua::load_core()`                  | `lua.loadCore()`                         | ✅ Covered      |
| `OLua::load_io()`                    | `lua.loadIo()`                           | ✅ Covered      |
| `OLua::total_memory()`               | `lua.totalMemory()`                      | ✅ Covered      |
| `OLua::gc_collect()`                 | `lua.gcCollect()`                        | ✅ Covered      |
| `OLua::gc_metrics()`                 | `lua.gcMetrics()`                        | ✅ Covered      |
| `Callback::from_fn`                  | `lua.registerCallback(name, fn)`         | ✅ Covered      |
| `Executor::start` + `Executor::step` | `lua.executor(code)` + `exec.step(fuel)` | ✅ Covered      |
| `Context::globals().set_raw`         | `lua.setGlobal(name, val)`               | ✅ Covered      |
| `Context::globals().get_raw`         | `lua.getGlobal(name)`                    | ✅ Covered      |
