# API Reference

This document provides a full reference for the Lua NAPI bindings exported by `@lib/module` (and `dist/index.js` / `index.js`).

---

## `Lua` Class

The primary class for creating, configuring, and executing embedded Lua environments.

### Factory Constructors

#### `Lua.full(): Lua`
Creates a `Lua` VM instance with all standard library modules loaded (including I/O, math, string, table, coroutine, etc.).

#### `Lua.core(): Lua`
Creates a `Lua` VM instance with core (non-I/O) standard library modules loaded (`math`, `string`, `table`, `coroutine`). Ideal for sandboxed execution without file or system I/O capabilities.

#### `Lua.empty(): Lua`
Creates an empty `Lua` VM instance without any standard library preloaded.

---

### Instance Methods

#### `eval(code: string): unknown`
Compiles and executes a Lua script or expression string.
- **Parameters:**
  - `code`: `string` — The Lua source code or expression to evaluate.
- **Returns:** `unknown` — The return value converted to JavaScript native types (`number`, `string`, `boolean`, or `undefined` for `nil`).
- **Throws:** Throws a JavaScript `Error` if compilation or runtime execution fails.

#### `setGlobal(name: string, value: unknown): void`
Sets a global variable or constant in the Lua environment.
- **Parameters:**
  - `name`: `string` — Name of the global variable.
  - `value`: `unknown` — Primitive value (`number`, `string`, `boolean`, `null`/`undefined`) or plain JavaScript object (which is recursively converted into a Lua table).

#### `loadCore(): void`
Dynamically loads the core standard library modules (`math`, `string`, `table`, `coroutine`) into the active Lua environment.

#### `loadIo(): void`
Dynamically loads the I/O standard library modules into the active Lua environment.

#### `totalMemory(): number`
Returns the total memory used by this Lua environment in bytes.

#### `gcCollect(): void`
Triggers a complete garbage collection cycle in the Lua garbage collector.

#### `gcMetrics(): GcMetrics`
Returns a snapshot of the current garbage collection metrics.
- **Returns:** `GcMetrics` (`{ totalAllocation: number, allocationDebt: number }`)

---

## Helper Functions

### `evalLua(code: string): unknown`
Convenience function exported from `src/main.ts` that instantiates a `Lua.full()` VM and evaluates the provided Lua code string.

---

## Interfaces

### `GcMetrics`

```typescript
export interface GcMetrics {
  totalAllocation: number; // Total memory allocated in bytes
  allocationDebt: number;  // Current GC allocation debt
}
```
