# `@alloy-ts/lua` API Documentation

The `@alloy-ts/lua` package provides a high-performance, sandboxed Lua 5.4 execution environment embedded into Node.js / JavaScript via NAPI (`@napi-rs/cli`) and `ottavino` (a pure Rust Lua 5.4 VM).

---

## Overview of Exported Classes & Types

When importing from `@alloy-ts/lua`:

```typescript
import { Lua, Globals, GcMetrics, __napiBindingTarget } from "@alloy-ts/lua";
```

| Symbol                | Kind        | Description                                                        |
| --------------------- | ----------- | ------------------------------------------------------------------ |
| `Lua`                 | `class`     | Main class for creating and interacting with Lua VM instances.     |
| `Globals`             | `class`     | Handle for interacting with global environment variables (`_ENV`). |
| `GcMetrics`           | `interface` | Interface representing garbage collection memory metrics.          |
| `__napiBindingTarget` | `string`    | Binary target identifier (`"native"`, `"wasm32-wasi"`, etc.).      |

---

## `Lua` Class

A handle to an isolated Lua 5.4 VM instance.

### Constructors & Static Factory Methods

#### `new Lua()`

- **Returns:** `Lua`
- Creates a new `Lua` instance with the full standard library loaded (base, coroutine, math, string, table, I/O).

#### `Lua.full()`

- **Returns:** `Lua`
- Factory method to create a `Lua` instance with full standard libraries loaded.

#### `Lua.core()`

- **Returns:** `Lua`
- Factory method to create a `Lua` instance with core standard libraries loaded (base, coroutine, math, string, table), omitting I/O libraries.

#### `Lua.empty()`

- **Returns:** `Lua`
- Factory method to create a bare, sandboxed `Lua` VM instance with no standard libraries loaded.

---

### Instance Methods

#### `globals(): Globals`

- **Returns:** `Globals`
- Returns a `Globals` handle for getting and setting global variables in the Lua environment (`_ENV`), mirroring Ottavino's Rust `globals()` API.

```typescript
const globals = lua.globals();
globals.set("appName", "My App");
console.log(globals.get("appName")); // "My App"
```

---

#### `eval(code: string): unknown`

- **Parameters:**
  - `code` (`string`): The Lua script or expression to compile and execute.
- **Returns:** `unknown`
- Compiles and executes the provided Lua code string, returning the result as a JavaScript value.

```typescript
const sum = lua.eval("return 10 + 20"); // 30
```

---

#### `setGlobal(name: string, value: unknown): void`

- Convenience shortcut delegating to `lua.globals().set(name, value)`. Binds JS primitives, objects, arrays, or JS functions to a global name in Lua.

```typescript
lua.setGlobal("add", (a: number, b: number) => a + b);
```

---

#### `getGlobal(name: string): unknown`

- Convenience shortcut delegating to `lua.globals().get(name)`. Retrieves a global variable from the Lua environment.

---

#### `loadCore(): void`

- Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`).

#### `loadIo(): void`

- Loads the I/O standard library.

#### `totalMemory(): number`

- Returns memory used by the Lua VM in bytes.

#### `gcCollect(): void`

- Triggers a full garbage collection cycle in the Lua VM.

#### `gcMetrics(): GcMetrics`

- Returns GC metrics (`totalAllocation`, `allocationDebt`).

---

## `Globals` Class

Provides access to the global variables table (`_ENV`).

### Methods

#### `get(name: string): unknown`

- Retrieves the value of a global variable by name. Returns `undefined` if unset.

#### `set(name: string, value: unknown): void`

- Binds a global variable in Lua.
- **JavaScript Functions $\rightarrow$ Ottavino `Callback`:** Passing a JS function (e.g., `(a, b) => a + b`) automatically converts it into a GC-managed `ottavino::Callback::from_fn`. Arguments on `ottavino::Stack` are translated to JS values, the JS function is invoked, and return values (or thrown errors) are marshalled back onto the stack.

```typescript
lua.globals().set("calculateTax", (amount: number) => amount * 0.2);
const tax = lua.eval("return calculateTax(100)"); // 20
```

---

## Type Conversions (TypeScript $\leftrightarrow$ Lua)

| JavaScript / TypeScript Type | Lua 5.4 Type                           |
| ---------------------------- | -------------------------------------- |
| `number` (integer)           | `integer`                              |
| `number` (float)             | `number` (float)                       |
| `string`                     | `string`                               |
| `boolean`                    | `boolean`                              |
| `null` / `undefined`         | `nil`                                  |
| `Array`                      | `table` (1-indexed sequential)         |
| `Object` (plain)             | `table` (keyed)                        |
| `Function` (from JS)         | `ottavino::Callback` (callable in Lua) |
| `Function` (from Lua)        | `"[lua function]"` placeholder string  |
