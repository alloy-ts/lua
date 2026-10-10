# Embedded Lua API Reference (`dist/index.js`)

This document provides a comprehensive API reference for the exported `Lua` class and types provided by `@lib/module` (`dist/index.js` / `dist/index.d.ts`).

---

## Table of Contents

- [Overview](#overview)
- [Importing](#importing)
- [Class: `Lua`](#class-lua)
  - [Constructors & Factories](#constructors--factories)
    - [`new Lua()`](#new-lua)
    - [`Lua.full()`](#luafull)
    - [`Lua.core()`](#luacore)
    - [`Lua.empty()`](#luaempty)
  - [Execution Methods](#execution-methods)
    - [`lua.eval(code)`](#luaevalcode)
  - [Global Variables & State](#global-variables--state)
    - [`lua.setGlobal(name, value)`](#luasetglobalname-value)
    - [`lua.getGlobal(name)`](#luagetglobalname)
  - [Standard Library Controls](#standard-library-controls)
    - [`lua.loadCore()`](#lualoadcore)
    - [`lua.loadIo()`](#lualoadio)
  - [Memory & Garbage Collection](#memory--garbage-collection)
    - [`lua.totalMemory()`](#luatotalmemory)
    - [`lua.gcCollect()`](#luagccollect)
    - [`lua.gcMetrics()`](#luagcmetrics)
- [Interface: `GcMetrics`](#interface-gcmetrics)
- [Type Mapping (JS ↔ Lua)](#type-mapping-js--lua)

---

## Overview

The `Lua` class represents an isolated Lua 5.4 Virtual Machine instance running natively inside Node.js via NAPI. Each instance maintains its own global environment, garbage-collected heap, and loaded standard libraries.

---

## Importing

```typescript
import { Lua, GcMetrics } from "@lib/module";
// or directly from the dist loader:
// import { Lua } from "./dist/index.js";
```

---

## Class: `Lua`

### Constructors & Factories

#### `new Lua()`
#### `Lua.full()`
* **Signature**: `new Lua(): Lua` / `Lua.full(): Lua`
* **Description**: Creates a new Lua VM instance with the **full** standard library loaded (base, coroutine, math, string, table, and I/O modules).
* **Returns**: A new `Lua` instance.
* **Example**:
  ```typescript
  const lua = Lua.full();
  console.log(lua.eval("return string.upper('hello')")); // "HELLO"
  ```

#### `Lua.core()`
* **Signature**: `Lua.core(): Lua`
* **Description**: Creates a new Lua VM instance with **core** standard libraries loaded (base, coroutine, math, string, table), but without I/O modules. Ideal for safe execution environments that don't need filesystem access.
* **Returns**: A new `Lua` instance.
* **Example**:
  ```typescript
  const lua = Lua.core();
  console.log(lua.eval("return math.sqrt(144)")); // 12
  ```

#### `Lua.empty()`
* **Signature**: `Lua.empty(): Lua`
* **Description**: Creates an **empty** sandboxed Lua VM instance with no standard libraries pre-loaded. Standard modules (`math`, `string`, `io`) must be explicitly loaded via `loadCore()` or `loadIo()` if needed.
* **Returns**: A new `Lua` instance.
* **Example**:
  ```typescript
  const lua = Lua.empty();
  // Standard math functions will throw until loadCore() is invoked
  lua.loadCore();
  console.log(lua.eval("return math.abs(-10)")); // 10
  ```

---

### Execution Methods

#### `lua.eval(code)`
* **Signature**: `eval(code: string): unknown`
* **Parameters**:
  * `code`: `string` — A valid Lua source code snippet or chunk to compile and evaluate.
* **Returns**: `unknown` — The resulting JavaScript representation of the evaluated Lua expression (primitives, objects, or arrays).
* **Throws**: An `Error` if compilation fails (`Lua compile error`) or if runtime execution fails (`Lua runtime error`).
* **Example**:
  ```typescript
  const sum = lua.eval("return 10 + 20"); // 30
  const user = lua.eval("return { name = 'Alice', age = 28 }"); // { name: 'Alice', age: 28 }
  ```

---

### Global Variables & State

#### `lua.setGlobal(name, value)`
* **Signature**: `setGlobal(name: string, value: unknown): void`
* **Parameters**:
  * `name`: `string` — The name of the global variable in Lua environment.
  * `value`: `unknown` — The JavaScript value (primitive, object, array, or null/undefined) to store as a global variable.
* **Example**:
  ```typescript
  lua.setGlobal("appName", "MyService");
  lua.setGlobal("serverConfig", { port: 8080, host: "localhost" });
  lua.setGlobal("rates", [1.1, 2.5, 3.8]);
  ```

#### `lua.getGlobal(name)`
* **Signature**: `getGlobal(name: string): unknown`
* **Parameters**:
  * `name`: `string` — The name of the global variable to retrieve from Lua environment.
* **Returns**: `unknown` — The converted JavaScript representation of the global variable.
* **Example**:
  ```typescript
  const appName = lua.getGlobal("appName"); // "MyService"
  const config = lua.getGlobal("serverConfig"); // { port: 8080, host: "localhost" }
  ```

---

### Standard Library Controls

#### `lua.loadCore()`
* **Signature**: `loadCore(): void`
* **Description**: Loads the core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into the current Lua state.

#### `lua.loadIo()`
* **Signature**: `loadIo(): void`
* **Description**: Loads the I/O standard library (`io`) into the current Lua state.

---

### Memory & Garbage Collection

#### `lua.totalMemory()`
* **Signature**: `totalMemory(): number`
* **Returns**: `number` — The total memory tracked by the Lua VM allocator, in bytes.
* **Example**:
  ```typescript
  console.log(`Memory in use: ${lua.totalMemory()} bytes`);
  ```

#### `lua.gcCollect()`
* **Signature**: `gcCollect(): void`
* **Description**: Forces a full garbage collection cycle inside the Lua VM arena to reclaim unreachable memory.

#### `lua.gcMetrics()`
* **Signature**: `gcMetrics(): GcMetrics`
* **Returns**: [`GcMetrics`](#interface-gcmetrics) — A snapshot object containing garbage collection metrics.
* **Example**:
  ```typescript
  const metrics = lua.gcMetrics();
  console.log(`Total allocation: ${metrics.totalAllocation} bytes`);
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

## Type Mapping (JS ↔ Lua)

| JavaScript Type | Lua Type | Notes |
| :--- | :--- | :--- |
| `number` (integer) | `integer` (i64) | Numbers with `fract() == 0` within int64 range |
| `number` (float) | `number` (f64) | Floating point numbers |
| `string` | `string` | UTF-8 interned strings |
| `boolean` | `boolean` | `true` / `false` |
| `null` / `undefined` | `nil` | Maps bidirectional |
| `Array` | `table` (sequence) | 1-based index table in Lua |
| `Object` | `table` | Key-value dictionary table |
