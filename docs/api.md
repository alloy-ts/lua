# API Reference

This document describes the API exported from `dist/index.js` and `@lib/module` for embedding Lua in TypeScript/JavaScript via NAPI.

## Exports Overview

From `dist/index.js` (and `@lib/module`):

- **Classes / Structs:**
  - `Lua`: The main execution environment for running Lua code.
  - `Context`: Internal bridge handle to an active garbage collector mutation context.
  - `Function`: Opaque handle to a Lua function prototype.
  - `RuntimeError`: Shareable wrapper around a Rust runtime error.
  - `ExternError`: Error object representing an unhandled Lua or runtime error across FFI boundaries.

---

## `Lua` Class

Top-level class representing a Lua 5.4 execution environment.

### Static Factory Methods

#### `Lua.empty(): Lua`

Creates a `Lua` instance with no standard library modules loaded.

#### `Lua.core(): Lua`

Creates a `Lua` instance with core non-I/O standard library modules loaded (`base`, `coroutine`, `math`, `string`, `table`).

#### `Lua.full(): Lua`

Creates a `Lua` instance with the full standard library loaded (including I/O).

---

### Instance Methods

#### `lua.setGlobal(key: string, value: string): void`

Sets a global variable in the Lua environment.

- **Parameters:**
  - `key` (`string`): Variable name in the global table.
  - `value` (`string`): String value to assign.

#### `lua.eval(code: string): string`

Compiles and evaluates a Lua code snippet, returning the string representation of the result value. Throws a JavaScript `Error` if compilation or execution fails.

- **Parameters:**
  - `code` (`string`): The Lua code snippet to compile and run.
- **Returns:** `string` — Display string of the returned value (`"nil"` if no value is returned).

#### `lua.loadCore(): void`

Loads core standard library modules (`base`, `coroutine`, `math`, `string`, `table`) into an existing `Lua` instance.

#### `lua.loadIo(): void`

Loads I/O standard library modules into an existing `Lua` instance.

#### `lua.totalMemory(): number`

Returns the total memory used by this Lua environment in bytes.

#### `lua.gcCollect(): void`

Runs a full garbage collection cycle.

#### `lua.gcMetrics(): GcMetrics`

Returns a snapshot of the current garbage collection metrics.

```typescript
interface GcMetrics {
  totalAllocation: number;
  allocationDebt: number;
}
```

---

## Usage Example

```typescript
import { Lua } from "@lib/module";

const lua = Lua.core();

// Set globals
lua.setGlobal("appName", "My App");

// Define functions and objects
lua.eval(`
  User = {
    name = "Alice",
    greet = function(self)
      return "Hello " .. self.name .. " from " .. appName
    end
  }
`);

// Evaluate
const greeting = lua.eval("return User:greet()");
console.log(greeting); // "Hello Alice from My App"
```
