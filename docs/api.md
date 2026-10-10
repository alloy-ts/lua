# Lua API Reference & Ottavino Coverage

This document provides a comprehensive API reference for `@lib/module` (exported via `index.js` and `dist/index.js`), which embeds a pure Rust/NAPI Lua 5.4 execution environment into TypeScript and JavaScript applications powered by **Ottavino** (derived from **Piccolo** and **`gc-arena`**).

For underlying architectural details (stackless VM design, `gc-arena`, symmetric coroutines), see [docs/architecture.md](architecture.md).
For Lua 5.4 language basics and standard library modules, see [docs/lang-guide.md](lang-guide.md).

---

## Exports Summary

```typescript
import { Lua, type GcMetrics, __napiBindingTarget } from "@lib/module";
```

- **`Lua`**: Main class representing a sandboxed Lua execution context.
- **`GcMetrics`**: Interface representing garbage collector statistics.
- **`__napiBindingTarget`**: String literal (`'native'`, `'wasm32-wasi'`, or `'wasm32-wasip1'`) identifying the loaded NAPI binding artifact.

---

## Ottavino Crate API vs. NAPI Coverage

The table below outlines the core Rust APIs provided by the `ottavino` crate and how they map to our NAPI TypeScript bindings:

| Ottavino Rust API                        | Description                                                                                                        | Current NAPI Binding Coverage                                                                                                                   |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ottavino::Lua`                          | Primary VM state and allocator owner.                                                                              | Exposed as TypeScript class `Lua` (`new Lua()`, `Lua.full()`, `Lua.core()`, `Lua.empty()`).                                                     |
| `Lua::load_core` / `load_io`             | Dynamic stdlib loading methods.                                                                                    | Exposed as `lua.loadCore()` and `lua.loadIo()`.                                                                                                 |
| `Lua::total_memory`                      | Memory tracking in bytes.                                                                                          | Exposed as `lua.totalMemory(): number`.                                                                                                         |
| `Lua::gc_collect`                        | Garbage collection trigger.                                                                                        | Exposed as `lua.gcCollect(): void`.                                                                                                             |
| `Lua::gc_metrics`                        | Allocator statistics snapshot.                                                                                     | Exposed as `lua.gcMetrics(): GcMetrics`.                                                                                                        |
| `ottavino::Value<'gc>`                   | Universal value enum (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). | Evaluated implicitly via `lua.eval()` and `lua.getGlobal()` / `lua.setGlobal()`. Mapped bi-directionally to JS primitives, objects, and arrays. |
| `ottavino::Table<'gc>`                   | Associative and sequential table structure.                                                                        | Converted automatically to JS Objects (`Record<string, unknown>`) or JS Arrays (`unknown[]`).                                                   |
| `ottavino::Closure<'gc>`                 | Compiled Lua bytecode chunk bound to `_ENV`.                                                                       | Managed internally during `lua.eval(code)`.                                                                                                     |
| `ottavino::Executor<'gc>`                | Stackless VM trampoline executor.                                                                                  | Driven internally to completion inside `lua.eval()`.                                                                                            |
| `ottavino::Callback<'gc>` / `CallbackFn` | Host functions implemented in Rust.                                                                                | Internal stdlib callbacks are pre-bound.                                                                                                        |
| `ottavino::Stack<'gc, '_>`               | Function argument/register stack.                                                                                  | Handled internally during function invocation and evaluation.                                                                                   |
| `ottavino::Thread<'gc>`                  | Lua coroutine execution context.                                                                                   | Returned as `"[lua thread]"` in string representations; managed via Lua `coroutine` library.                                                    |
| `ottavino::Fuel`                         | Instruction stepping and pacing counter.                                                                           | Bounded internally during evaluation loops.                                                                                                     |

---

## Class: `Lua`

The `Lua` class represents an isolated Lua VM state.

### Constructors & Factory Methods

#### `new Lua()`

Instantiates a new Lua environment with the **full** standard library loaded (base, math, string, table, coroutine, and I/O).

```typescript
const lua = new Lua();
```

#### `Lua.full(): Lua`

Static factory method. Creates a Lua VM instance with all standard libraries pre-loaded. Equivalent to `new Lua()`.

```typescript
const lua = Lua.full();
```

#### `Lua.core(): Lua`

Static factory method. Creates a Lua VM instance with core standard libraries pre-loaded (base, math, string, table, coroutine), excluding I/O libraries.

```typescript
const lua = Lua.core();
```

#### `Lua.empty(): Lua`

Static factory method. Creates a minimal, completely empty sandboxed Lua VM with no standard libraries loaded.

```typescript
const lua = Lua.empty();
```

---

### Instance Methods

#### `lua.eval(code: string): unknown`

Compiles and executes the provided Lua script string and returns the result as a JavaScript value.

- **Parameters:**
  - `code` (`string`): A string containing valid Lua source code.
- **Returns:** `unknown` - The evaluated result converted to its JavaScript equivalent.
- **Throws:** `Error` if compilation fails (`Lua compile error: ...`) or if a runtime error occurs (`Lua runtime error: ...`).

```typescript
const result = lua.eval("return 10 + 20 * 2");
console.log(result); // 50
```

---

#### `lua.setGlobal(name: string, value: unknown): void`

Sets a global variable in the Lua environment.

- **Parameters:**
  - `name` (`string`): Name of the global variable.
  - `value` (`unknown`): The JavaScript value (primitive, array, or object) to set in Lua.

```typescript
lua.setGlobal("maxUsers", 500);
lua.setGlobal("config", { env: "production", debug: false });
```

---

#### `lua.getGlobal(name: string): unknown`

Retrieves a global variable from the Lua environment by name.

- **Parameters:**
  - `name` (`string`): Name of the global variable to retrieve.
- **Returns:** `unknown` - The value of the global variable converted to JavaScript.

```typescript
const env = lua.getGlobal("config");
console.log(env); // { env: 'production', debug: false }
```

---

#### `lua.loadCore(): void`

Loads core standard libraries (`base`, `math`, `string`, `table`, `coroutine`) into an existing Lua VM instance.

```typescript
const lua = Lua.empty();
lua.loadCore(); // Enables math, string, table, etc.
```

---

#### `lua.loadIo(): void`

Loads the I/O standard library into an existing Lua VM instance.

```typescript
const lua = Lua.core();
lua.loadIo(); // Enables I/O functions like print
```

---

#### `lua.totalMemory(): number`

Returns total memory currently allocated and tracked by the Lua VM, measured in bytes.

- **Returns:** `number` - Total byte size.

```typescript
const bytesUsed = lua.totalMemory();
console.log(`Memory used: ${bytesUsed} bytes`);
```

---

#### `lua.gcCollect(): void`

Triggers a full garbage collection cycle inside the Lua VM allocator.

```typescript
lua.gcCollect();
```

---

#### `lua.gcMetrics(): GcMetrics`

Returns garbage collector allocator metrics snapshot.

- **Returns:** `GcMetrics` - Object containing `totalAllocation` and `allocationDebt`.

```typescript
const metrics = lua.gcMetrics();
console.log("Total Allocation:", metrics.totalAllocation);
console.log("Allocation Debt:", metrics.allocationDebt);
```

---

## Interface: `GcMetrics`

```typescript
export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt. */
  allocationDebt: number;
}
```

---

## Type Conversion Mapping

The NAPI binding automatically maps types between TypeScript/JavaScript and Lua:

| JavaScript / TypeScript Type         | Lua Type              | Notes                                                                     |
| :----------------------------------- | :-------------------- | :------------------------------------------------------------------------ |
| `number` (integer)                   | `integer`             | Numbers with zero fractional part within `i64` range map to Lua integers. |
| `number` (float)                     | `number` (float)      | Floating point numbers map to double-precision floats.                    |
| `string`                             | `string`              | UTF-8 strings.                                                            |
| `boolean`                            | `boolean`             | `true` or `false`.                                                        |
| `null` / `undefined`                 | `nil`                 | Maps bi-directionally to Lua `nil`.                                       |
| `Array` (`T[]`)                      | `table` (sequence)    | Converted to a 1-indexed sequential Lua table.                            |
| `Object` (`Record<string, unknown>`) | `table` (associative) | Converted to a key-value Lua table.                                       |
| Lua Function                         | `string`              | Converted to string `"[lua function]"`.                                   |
| Lua Thread / Coroutine               | `string`              | Converted to string `"[lua thread]"`.                                     |
| Lua Userdata                         | `string`              | Converted to string `"[lua userdata]"`.                                   |

---

## Error Handling

All Lua compilation and runtime errors are converted into JavaScript `Error` instances:

- **Compilation / Syntax Errors:**
  Thrown when code supplied to `.eval()` fails Lua parsing.
  Error message format: `Lua compile error: <details>`

- **Runtime Execution Errors:**
  Thrown when code execution fails at runtime (e.g., operating on `nil`, calling non-functions).
  Error message format: `Lua runtime error: <details>`

### Example

```typescript
try {
  lua.eval("invalid + syntax +++");
} catch (err) {
  console.error((err as Error).message); // "Lua compile error: parse error"
}
```
