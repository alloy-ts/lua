# API Documentation for `@alloy-ts/lua`

The `@alloy-ts/lua` package provides a high-performance JavaScript/TypeScript interface to a pure Rust Lua 5.4 execution environment (`ottavino` / `piccolo`) compiled via [NAPI-RS](https://napi.rs/).

---

## Table of Contents

- [Overview & Rust Architecture Mapping](#overview--rust-architecture-mapping)
- [Exported Class: `Lua`](#exported-class-lua)
  - [Constructors & Factory Methods](#constructors--factory-methods)
  - [Evaluation & Execution](#evaluation--execution)
  - [Global State Binding](#global-state-binding)
  - [Standard Library Loading](#standard-library-loading)
  - [Memory & Garbage Collection](#memory--garbage-collection)
- [Exported Interfaces](#exported-interfaces)
  - [`GcMetrics`](#gcmetrics)
- [Value Conversion Rules](#value-conversion-rules)

---

## Overview & Rust Architecture Mapping

At the native layer (written in Rust in `src/lua.rs`), `@alloy-ts/lua` wraps the `ottavino` (Piccolo) Lua 5.4 VM crate:

| Ottavino (Rust) Type | NAPI Wrapper / Exposure in `@alloy-ts/lua` | Description |
| -------------------- | ------------------------------------------ | ----------- |
| `ottavino::Lua` | `export class Lua` | The top-level Lua VM owner and GC arena host. |
| `ottavino::Context<'gc>` | Managed inside Rust NAPI methods | Execution and allocation context for the `gc-arena`. |
| `ottavino::Executor` | Managed inside `lua.eval()` | Stackless VM runner that steps through Lua bytecode chunks. |
| `ottavino::Value<'gc>` | Converted JS primitives / objects / arrays | Corresponds to Lua values (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). |
| `ottavino::Table<'gc>` | JS `Object` or `Array` | Corresponds to Lua table associative arrays / sequences. |
| `ottavino::GcMetrics` | `interface GcMetrics` | Snapshot metrics from the VM memory allocator. |

---

## Exported Class: `Lua`

The `Lua` class represents an isolated Lua VM state.

### Constructors & Factory Methods

#### `new Lua()`
- **Returns**: `Lua`
- Creates a new Lua instance with the full standard library loaded (equivalent to `Lua.full()`).

```typescript
import { Lua } from "@alloy-ts/lua";

const lua = new Lua();
```

#### `Lua.full()`
- **Returns**: `Lua`
- Instantiates a Lua VM state with full standard libraries pre-loaded (base, coroutine, math, string, table, I/O).

```typescript
const lua = Lua.full();
```

#### `Lua.core()`
- **Returns**: `Lua`
- Instantiates a sandboxed Lua VM state with core libraries loaded (base, coroutine, math, string, table) but omitting file/system I/O.

```typescript
const lua = Lua.core();
```

#### `Lua.empty()`
- **Returns**: `Lua`
- Instantiates an isolated Lua VM state with **no** standard libraries loaded. Useful for strict sandboxing.

```typescript
const lua = Lua.empty();
```

---

### Evaluation & Execution

#### `lua.eval(code: string): unknown`
- **Parameters**:
  - `code` (`string`): The Lua source chunk to compile and execute.
- **Returns**: `unknown` (converted JavaScript representation of the Lua expression's return value).
- **Throws**: Error on compilation (syntax) or runtime failure.

```typescript
const sum = lua.eval("return 10 + 20") as number; // 30
```

---

### Global State Binding

#### `lua.setGlobal(name: string, value: unknown): void`
- **Parameters**:
  - `name` (`string`): Global variable name in Lua.
  - `value` (`unknown`): Value to bind into the Lua global environment.
- Binds a JavaScript primitive, array, or object into the Lua global state.

```typescript
lua.setGlobal("config", { host: "localhost", port: 8080 });
```

#### `lua.getGlobal(name: string): unknown`
- **Parameters**:
  - `name` (`string`): Global variable name in Lua.
- **Returns**: `unknown`
- Fetches a global variable from the Lua VM, converted into a JavaScript value.

```typescript
const config = lua.getGlobal("config");
```

---

### Standard Library Loading

#### `lua.loadCore(): void`
- Loads core standard libraries (base, coroutine, math, string, table) into an existing Lua VM instance (e.g., initialized via `Lua.empty()`).

#### `lua.loadIo(): void`
- Loads I/O standard libraries into an existing Lua VM instance.

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`
- **Returns**: `number`
- Returns the total memory (in bytes) currently used by the Lua VM context.

#### `lua.gcCollect(): void`
- Triggers a full garbage collection cycle in the Lua VM.

#### `lua.gcMetrics(): GcMetrics`
- **Returns**: `GcMetrics`
- Returns snapshot metrics from the Lua garbage collector allocator.

---

## Exported Interfaces

### `GcMetrics`

```typescript
export interface GcMetrics {
  /** Total bytes tracked by the allocator */
  totalAllocation: number;
  /** Current allocation debt */
  allocationDebt: number;
}
```

---

## Value Conversion Rules

Values exchanged between JavaScript/TypeScript and Lua via `lua.eval()`, `lua.setGlobal()`, and `lua.getGlobal()` are marshaled according to the following rules:

### Lua → JavaScript

| Lua Value Type | Returned JavaScript Value Type | Note / Representation |
| -------------- | ----------------------------- | --------------------- |
| `nil` | `undefined` | Unset or nil values map to `undefined` |
| `boolean` | `boolean` | `true` or `false` |
| `integer` | `number` | Converted to JS float/int number |
| `float` | `number` | Converted to JS number |
| `string` | `string` | UTF-8 decoded string |
| `table` (sequential) | `Array` | 1-indexed sequential tables become 0-indexed JS Arrays |
| `table` (keyed/hash) | `Object` | Keyed table entries become JS Object properties |
| `function` | `string` | Returned as `"[lua function]"` placeholder |
| `thread` | `string` | Returned as `"[lua thread]"` placeholder |
| `userdata` | `string` | Returned as `"[lua userdata]"` placeholder |

### JavaScript → Lua

| JavaScript Value Type | Converted Lua Value Type | Note / Representation |
| --------------------- | ------------------------ | --------------------- |
| `undefined` / `null` | `nil` | Maps directly to Lua `nil` |
| `boolean` | `boolean` | `true` or `false` |
| `number` (integer) | `integer` | Numbers with zero fractional component fit in `i64` |
| `number` (float) | `number` | Floating-point numbers |
| `string` | `string` | String interned in Lua VM |
| `Array` | `table` | Converted to 1-indexed sequential table |
| `Object` | `table` | Plain objects converted to string-keyed hash table |
