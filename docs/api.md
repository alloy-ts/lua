# API Reference for `@alloy-ts/lua`

The `@alloy-ts/lua` library exposes native Lua VM bindings built via [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM).

---

## Exports from `dist/index.js` / `@alloy-ts/lua`

- **`Lua`**: The main class providing execution context, variable binding, and VM control.
- **`GcMetrics`**: Interface describing garbage collector statistics.
- **`__napiBindingTarget`**: String indicating the loaded binary target (`'native'`, `'wasm32-wasi'`, or `'wasm32-wasip1'`).

---

## `Lua` Class

Represents an isolated Lua 5.4 VM execution environment.

```typescript
import { Lua } from "@alloy-ts/lua";
```

### Constructors & Static Factory Methods

#### `new Lua()`

- **Returns**: `Lua`
- Creates a new `Lua` instance with the full standard library loaded (base, coroutine, math, string, table, I/O).

#### `Lua.full(): Lua`

- **Returns**: `Lua`
- Static factory method that instantiates a Lua VM with the full standard library loaded.

#### `Lua.core(): Lua`

- **Returns**: `Lua`
- Static factory method that instantiates a Lua VM with core standard libraries loaded (base, coroutine, math, string, table) without I/O.

#### `Lua.empty(): Lua`

- **Returns**: `Lua`
- Static factory method that instantiates an isolated, empty Lua VM with no standard libraries loaded.

---

### Instance Methods

#### `eval(code: string): unknown`

Compiles and executes a Lua code string in the VM environment, returning the result as a JavaScript value.

- **Parameters**: `code` (`string`) — Lua source code string to evaluate.
- **Returns**: `unknown` — The converted JavaScript representation of the evaluated Lua expression (or `undefined` if no value is returned).
- **Throws**:
  - `Lua compile error: ...` if compilation or syntax parsing fails.
  - `Lua runtime error: ...` if a runtime error occurs during execution.

#### `setGlobal(name: string, value: unknown): void`

Binds or sets a global variable in the Lua VM environment.

- **Parameters**:
  - `name` (`string`) — Name of the global variable in Lua.
  - `value` (`unknown`) — JavaScript value to assign. JavaScript primitives and objects are automatically converted to corresponding Lua types.

#### `getGlobal(name: string): unknown`

Retrieves the value of a global variable from the Lua VM environment.

- **Parameters**: `name` (`string`) — Name of the global variable.
- **Returns**: `unknown` — Converted JavaScript representation of the Lua global variable (or `undefined` if not set / `nil`).

#### `loadCore(): void`

Loads the core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua VM context. Useful when starting from `Lua.empty()`.

#### `loadIo(): void`

Loads the `io` (I/O) standard library into an existing Lua VM context.

#### `totalMemory(): number`

Returns the total memory used by the Lua VM context in bytes.

- **Returns**: `number` — Total memory allocated in bytes.

#### `gcCollect(): void`

Triggers a manual full garbage collection cycle inside the Lua VM.

#### `gcMetrics(): GcMetrics`

Retrieves the current garbage collection metrics snapshot.

- **Returns**: `GcMetrics` object containing `totalAllocation` and `allocationDebt`.

---

## `GcMetrics` Interface

Describes the garbage collector memory statistics.

```typescript
export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt. */
  allocationDebt: number;
}
```

---

## Type Conversions (JS ↔ Lua)

### JavaScript to Lua (`setGlobal`)

| JavaScript / TypeScript Type | Converted Lua Type             |
| :--------------------------- | :----------------------------- |
| `undefined` / `null`         | `nil`                          |
| `boolean`                    | `boolean`                      |
| `number` (integer)           | `integer`                      |
| `number` (float)             | `number` (float)               |
| `string`                     | `string`                       |
| `Array`                      | Sequential `table` (1-indexed) |
| Plain `Object`               | Keyed `table`                  |

### Lua to JavaScript (`eval` / `getGlobal`)

| Lua Type                          | Converted JavaScript / TypeScript Value |
| :-------------------------------- | :-------------------------------------- |
| `nil`                             | `undefined`                             |
| `boolean`                         | `boolean`                               |
| `integer`                         | `number`                                |
| `float`                           | `number`                                |
| `string`                          | `string`                                |
| `table` (sequential / length > 0) | `Array`                                 |
| `table` (keyed / empty)           | `Object`                                |
| `function`                        | `"[lua function]"` (placeholder string) |
| `thread`                          | `"[lua thread]"` (placeholder string)   |
| `userdata`                        | `"[lua userdata]"` (placeholder string) |
