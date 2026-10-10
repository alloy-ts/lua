# API Reference

This document describes the exported TypeScript / JavaScript API for the embedded Lua engine provided via NAPI.

## `Lua` Class

Top-level class representing an isolated Lua execution state and virtual machine instance.

### Constructors & Factories

#### `new Lua()`
- **Description:** Constructs a new `Lua` instance with the full standard library loaded (including I/O operations).
- **Returns:** `Lua`

#### `Lua.empty(): Lua`
- **Description:** Factory method to construct a `Lua` instance with **no** standard library modules loaded (completely sandboxed).
- **Returns:** `Lua`

#### `Lua.core(): Lua`
- **Description:** Factory method to construct a `Lua` instance with core (non-I/O) standard library modules loaded (`base`, `coroutine`, `math`, `string`, `table`).
- **Returns:** `Lua`

#### `Lua.full(): Lua`
- **Description:** Factory method to construct a `Lua` instance with the full standard library loaded (identical to `new Lua()`).
- **Returns:** `Lua`

---

### Instance Methods

#### `loadCore(): void`
- **Description:** Loads core standard library modules (`base`, `coroutine`, `math`, `string`, `table`) into the current Lua environment.

#### `loadIo(): void`
- **Description:** Loads I/O standard library modules into the current Lua environment.

#### `eval(code: string): string`
- **Description:** Compiles and executes a string of Lua source code, returning the main return value formatted as a string.
- **Parameters:**
  - `code` (`string`): The Lua code snippet to execute.
- **Returns:** `string` - The string representation of the evaluated Lua result (`"nil"`, `"3"`, `"true"`, string values, or object formatting).

#### `totalMemory(): number`
- **Description:** Returns the total memory (in bytes) currently allocated and tracked by this Lua state.
- **Returns:** `number`

#### `gcCollect(): void`
- **Description:** Triggers and completes a full garbage collection cycle inside the Lua state.

#### `gcMetrics(): GcMetrics`
- **Description:** Obtains a snapshot of current garbage collector metrics.
- **Returns:** `GcMetrics`

---

## Interfaces

### `GcMetrics`

```typescript
export interface GcMetrics {
  totalAllocation: number; // Total bytes allocated and tracked
  allocationDebt: number;  // Current GC allocation debt
}
```
