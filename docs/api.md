# API Reference

This document provides a detailed reference for the exported `Lua` class, types, and API coverage provided by the native NAPI module (`dist/index.js`).

## Exported Members

```ts
import { Lua, GcMetrics, __napiBindingTarget } from "@lib/module";
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

Instantiates a bare, empty Lua VM with no standard libraries loaded (for maximum sandboxing).

---

### Code Execution & Variables

#### `lua.eval(source: string): unknown`

Compiles and executes the given Lua code string, returning the result as a JavaScript value.

- **Parameters**: `source` (string) - The Lua code to execute.
- **Returns**: `unknown` - The converted JavaScript value corresponding to the return value of the Lua script.
- **Throws**: JavaScript Error if the Lua code contains syntax errors or runtime exceptions.

#### `lua.setGlobal(name: string, value: unknown): void`

Sets a global variable in the Lua VM environment. Converts JavaScript primitives (`boolean`, `number`, `string`, `null`/`undefined`) and complex objects/arrays into corresponding Lua primitives and tables.

- **Parameters**:
  - `name` (string) - The variable name in Lua.
  - `value` (unknown) - The value to assign.

#### `lua.getGlobal(name: string): unknown`

Retrieves a global variable from the Lua VM environment as a converted JavaScript value.

- **Parameters**: `name` (string) - The variable name in Lua.
- **Returns**: `unknown` - The converted JavaScript value.

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

## Interface: `GcMetrics`

Represents garbage collector allocation metrics for a `Lua` instance.

```ts
export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt triggering collector cycles. */
  allocationDebt: number;
}
```

---

## Ottavino Crate API Coverage Summary

| Ottavino Crate API                       | NAPI Exported Binding      | Coverage Status |
| :--------------------------------------- | :------------------------- | :-------------- |
| `OLua::full()` / `OLua::default()`       | `new Lua()` / `Lua.full()` | ✅ Covered      |
| `OLua::core()`                           | `Lua.core()`               | ✅ Covered      |
| `OLua::empty()`                          | `Lua.empty()`              | ✅ Covered      |
| `OLua::load_core()`                      | `lua.loadCore()`           | ✅ Covered      |
| `OLua::load_io()`                        | `lua.loadIo()`             | ✅ Covered      |
| `OLua::total_memory()`                   | `lua.totalMemory()`        | ✅ Covered      |
| `OLua::gc_collect()`                     | `lua.gcCollect()`          | ✅ Covered      |
| `OLua::gc_metrics()`                     | `lua.gcMetrics()`          | ✅ Covered      |
| `Closure::load` + `Executor` + `execute` | `lua.eval(code)`           | ✅ Covered      |
| `Context::globals().set_raw`             | `lua.setGlobal(name, val)` | ✅ Covered      |
| `Context::globals().get_raw`             | `lua.getGlobal(name)`      | ✅ Covered      |
