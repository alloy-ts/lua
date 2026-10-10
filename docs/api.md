# API Reference

Complete documentation for the exported NAPI bindings and TypeScript/JavaScript API for embedding Lua.

## Table of Contents

- [Class: `Lua`](#class-lua)
  - [Constructors](#constructors)
    - [`new Lua()`](#new-lua)
    - [`Lua.full()`](#luafull)
    - [`Lua.core()`](#luacore)
    - [`Lua.empty()`](#luaempty)
  - [Code Execution](#code-execution)
    - [`lua.eval(code: string): unknown`](#luaevalcode-string-unknown)
  - [Global Variable Management](#global-variable-management)
    - [`lua.setGlobal(name: string, value: unknown): void`](#luasetglobalname-string-value-unknown-void)
    - [`lua.getGlobal(name: string): unknown`](#luagetglobalname-string-unknown)
  - [Standard Library Management](#standard-library-management)
    - [`lua.loadCore(): void`](#lualoadcore-void)
    - [`lua.loadIo(): void`](#lualoadio-void)
  - [Memory & Garbage Collection](#memory--garbage-collection)
    - [`lua.totalMemory(): number`](#luatotalmemory-number)
    - [`lua.gcCollect(): void`](#luagccollect-void)
    - [`lua.gcMetrics(): GcMetrics`](#luagcmetrics-gcmetrics)
- [Interfaces](#interfaces)
  - [`GcMetrics`](#gcmetrics)
- [Constants](#constants)
  - [`__napiBindingTarget`](#__napibindingtarget)
- [Type Mapping (JS/TS <-> Lua)](#type-mapping-jsts---lua)

---

## Class: `Lua`

Represents an isolated, sandboxed Lua 5.4 execution environment managed via NAPI.

### Constructors

#### `new Lua()`

- **Returns**: `Lua`
- Creates a new Lua VM instance with the full standard library pre-loaded (base, coroutine, math, string, table, and I/O).

#### `Lua.full()`

- **Returns**: `Lua`
- Static factory method that instantiates a Lua VM with the full standard library loaded.

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();
```

#### `Lua.core()`

- **Returns**: `Lua`
- Static factory method that instantiates a Lua VM with core standard libraries pre-loaded (`base`, `coroutine`, `math`, `string`, `table`), excluding I/O.

```typescript
const lua = Lua.core();
```

#### `Lua.empty()`

- **Returns**: `Lua`
- Static factory method that instantiates a bare, unpopulated Lua VM with no standard libraries pre-loaded. Ideal for secure sandboxing.

```typescript
const lua = Lua.empty();
```

---

### Code Execution

#### `lua.eval(code: string): unknown`

- **Parameters**:
  - `code` (`string`): The Lua source code string to execute.
- **Returns**: `unknown` (The evaluated result converted to a JS primitive, array, or object)
- **Throws**: `Error` if compilation fails (`Lua compile error: ...`) or if a runtime error occurs (`Lua runtime error: ...`).

Compiles and executes the given Lua code string in the VM state context.

```typescript
const numResult = lua.eval("return 10 * 20"); // 200
const strResult = lua.eval("return 'Hello ' .. 'Lua'"); // "Hello Lua"
const tableResult = lua.eval("return { a = 1, b = 2 }"); // { a: 1, b: 2 }
```

---

### Global Variable Management

#### `lua.setGlobal(name: string, value: unknown): void`

- **Parameters**:
  - `name` (`string`): The global variable name in Lua.
  - `value` (`unknown`): The JavaScript value to bind (primitives, objects, arrays, null/undefined).
- **Returns**: `void`

Binds a JavaScript value to a global variable name inside the Lua VM environment.

```typescript
lua.setGlobal("MAX_LIMIT", 500);
lua.setGlobal("USER_DATA", { name: "Alice", active: true });
lua.setGlobal("ITEMS", [1, 2, 3]);
```

#### `lua.getGlobal(name: string): unknown`

- **Parameters**:
  - `name` (`string`): The global variable name in Lua to retrieve.
- **Returns**: `unknown`

Retrieves a global variable from the Lua VM environment, converted to its corresponding JavaScript representation.

```typescript
const limit = lua.getGlobal("MAX_LIMIT"); // 500
const user = lua.getGlobal("USER_DATA"); // { name: 'Alice', active: true }
```

---

### Standard Library Management

#### `lua.loadCore(): void`

- **Returns**: `void`

Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into the existing Lua VM instance.

```typescript
const lua = Lua.empty();
lua.loadCore();
console.log(lua.eval("return math.sqrt(16)")); // 4
```

#### `lua.loadIo(): void`

- **Returns**: `void`

Loads the I/O standard library into the existing Lua VM instance.

```typescript
lua.loadIo();
```

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`

- **Returns**: `number` (Bytes)

Returns the total amount of process memory currently allocated and tracked by the Lua VM in bytes.

```typescript
const bytesUsed = lua.totalMemory();
console.log(`Used ${bytesUsed} bytes`);
```

#### `lua.gcCollect(): void`

- **Returns**: `void`

Triggers an immediate full garbage collection cycle inside the Lua VM to reclaim unreachable memory.

```typescript
lua.gcCollect();
```

#### `lua.gcMetrics(): GcMetrics`

- **Returns**: [`GcMetrics`](#gcmetrics)

Returns a snapshot of the current garbage collector metrics.

```typescript
const metrics = lua.gcMetrics();
console.log(metrics.totalAllocation, metrics.allocationDebt);
```

---

## Interfaces

### `GcMetrics`

Represents garbage collector allocation statistics.

```typescript
export interface GcMetrics {
  /** Total bytes tracked by the allocator. */
  totalAllocation: number;
  /** Current allocation debt. */
  allocationDebt: number;
}
```

---

## Constants

### `__napiBindingTarget`

- **Type**: `'native' | 'wasm32-wasi' | 'wasm32-wasip1'`
- Indicates which NAPI binary target artifact was loaded by the module loader at runtime (`'native'` for native shared libraries or `'wasm32-wasip1'` / `'wasm32-wasi'` for WebAssembly artifacts).

---

## Type Mapping (JS/TS <-> Lua)

NAPI performs automatic bidirectional mapping between JavaScript/TypeScript types and Lua types:

| JavaScript / TypeScript Type  | Lua Type             | Notes                                                             |
| :---------------------------- | :------------------- | :---------------------------------------------------------------- |
| `number` (integer: e.g. `42`) | `integer`            | Automatically preserved as 64-bit Lua integer when fraction is 0. |
| `number` (float: e.g. `3.14`) | `number`             | Mapped to 64-bit IEEE double float.                               |
| `string`                      | `string`             | UTF-8 string encoding.                                            |
| `boolean`                     | `boolean`            | `true` or `false`.                                                |
| `null` / `undefined`          | `nil`                | Represents unassigned or missing values in Lua.                   |
| `Array` (e.g. `[10, 20]`)     | `table` (sequential) | 1-indexed Lua array table.                                        |
| `Object` (e.g. `{ a: 1 }`)    | `table` (dictionary) | Key-value dictionary Lua table.                                   |
