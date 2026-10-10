# API Reference

This document provides a detailed reference for the exported `Lua` class and types provided by the native NAPI module (`dist/index.js`).

## Exported Members

```ts
import { Lua, GcMetrics, __napiBindingTarget } from "@lib/module";
```

---

## Class: `Lua`

The `Lua` class represents an isolated Lua 5.4 execution environment managed inside a garbage-collected arena.

### Constructors & Factories

#### `new Lua()`

Creates a new `Lua` instance with the full standard library loaded (base, coroutine, math, string, table, io).

#### `Lua.core(): Lua`

Factory method that creates a new `Lua` instance with the core (non-I/O) standard library loaded.

#### `Lua.empty(): Lua`

Factory method that creates a bare `Lua` instance with no standard library modules loaded.

---

### Execution & Variables

#### `eval(source: string): unknown`

Compiles and evaluates a string of Lua source code.

- **Parameters**: `source` (string) - The Lua code to execute.
- **Returns**: `unknown` - The converted JavaScript value corresponding to the return value of the Lua script.
- **Throws**: JavaScript Error if the Lua code contains syntax errors or runtime exceptions.

#### `setGlobal(name: string, value: unknown): void`

Sets a global variable in the Lua execution context.

- **Parameters**:
  - `name` (string) - The variable name in Lua.
  - `value` (unknown) - The value to assign (converted automatically to Lua primitive or table).

#### `getGlobal(name: string): unknown`

Retrieves the value of a global variable from the Lua execution context.

- **Parameters**: `name` (string) - The variable name in Lua.
- **Returns**: `unknown` - The converted JavaScript value.

---

### Standard Library Loading

#### `loadCore(): void`

Dynamically loads the core parts of the Lua standard library (base, coroutine, math, string, table) into the environment.

#### `loadIo(): void`

Dynamically loads the I/O standard library modules into the environment.

---

### Memory & Garbage Collection

#### `totalMemory(): number`

Returns the total size of all memory used by this Lua instance, in bytes.

#### `gcCollect(): void`

Triggers a complete garbage collection cycle in the underlying Lua arena.

#### `gcMetrics(): GcMetrics`

Returns a snapshot of the garbage collector metrics.

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
