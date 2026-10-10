# API Reference

This document provides a detailed reference for the `@alloy-ts/lua` library API exported via NAPI.

## Exported Members

The primary export from `@alloy-ts/lua` (and `dist/index.js`) is the `Lua` class:

```typescript
import { Lua, GcMetrics, __napiBindingTarget } from "@alloy-ts/lua";
```

### `Lua` Class

#### Constructors & Static Factory Methods

- **`new Lua()`**: Instantiates a new Lua 5.4 VM with standard libraries loaded.
- **`Lua.full(): Lua`**: Static factory method that instantiates a Lua VM with standard libraries loaded (base, coroutine, math, string, table).
- **`Lua.core(): Lua`**: Static factory method that instantiates a Lua VM with core standard libraries loaded.
- **`Lua.empty(): Lua`**: Static factory method that instantiates an isolated Lua VM with no standard libraries pre-loaded.

#### Methods

- **`lua.eval(code: string): unknown`**
  Compiles and evaluates the given Lua script string in the VM state. Returns the resulting value converted to JavaScript primitives, arrays, or objects. Throws if a compile error or runtime error occurs.

- **`lua.setGlobal(name: string, value: unknown): void`**
  Binds a global variable in the Lua environment under `name`. Automatically converts JS primitives (number, string, boolean, undefined/null), JS functions (callbacks), and JS objects/arrays into Lua types, functions, and tables.

- **`lua.registerCallback(name: string, callback: (...args: unknown[]) => unknown): void`**
  Registers a JavaScript/TypeScript function as a global callback callable directly from Lua scripts. Translates Lua `Stack` arguments to JS values and converts JS return values back onto the Lua stack.

- **`lua.getGlobal(name: string): unknown`**
  Retrieves the value of a global variable from the Lua environment by `name` and converts it to a JS value.

- **`lua.loadCore(): void`**
  Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua state.

- **`lua.loadIo(): void`**
  Loads standard I/O library definitions into an existing Lua state.

- **`lua.totalMemory(): number`**
  Returns the total memory used by the Lua VM in bytes.

- **`lua.gcCollect(): void`**
  Triggers a full garbage collection cycle inside the Lua VM.

- **`lua.gcMetrics(): GcMetrics`**
  Returns garbage collector metrics for the Lua allocator.

---

### `GcMetrics` Interface

```typescript
export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt. */
  allocationDebt: number;
}
```

---

### Additional Exports

- **`__napiBindingTarget`**: A string indicating which binding artifact was loaded (`'native'`, `'wasm32-wasi'`, `'wasm32-wasip1'`).

---

## Value Conversion Rules

| JS / TS Type | Lua Type | Notes |
| --- | --- | --- |
| `undefined` / `null` | `nil` | Round-trips as `undefined` in JS |
| `number` (integer) | `integer` | Parsed as integer if `n.fract() == 0` |
| `number` (float) | `number` | Floating point number |
| `string` | `string` | Interned string in Lua |
| `boolean` | `boolean` | Primitive boolean |
| `Function` (from JS) | `function` (callback) | Wrapped in `ottavino::Callback` and callable inside Lua |
| `Array` | `table` (sequential) | Converted to 1-indexed sequential Lua table |
| `Object` (plain) | `table` (keyed) | Converted to key-value Lua table |
| `Function` | `"[lua function]"` | Surfaced in JS as a placeholder string |
