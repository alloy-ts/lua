# Embedded Lua API Reference (`dist/index.js`)

This document provides a comprehensive API reference for the exported `Lua` class, `Globals` handle, `Executor` handle, and types provided by `@lib/module` (`dist/index.js` / `dist/index.d.ts`).

---

## Table of Contents

- [Overview](#overview)
- [Importing](#importing)
- [Class: `Lua`](#class-lua)
  - [Constructors & Factories](#constructors--factories)
  - [Globals Handle](#globals-handle)
    - [`lua.globals()`](#luaglobals)
  - [Execution & Stepping](#execution--stepping)
    - [`lua.eval(code)`](#luaevalcode)
    - [`lua.executor(code)`](#luaexecutorcode)
  - [Convenience Aliases](#convenience-aliases)
    - [`lua.setGlobal(name, value)`](#luasetglobalname-value)
    - [`lua.getGlobal(name)`](#luagetglobalname)
    - [`lua.registerCallback(name, callback)`](#luaregistercallbackname-callback)
  - [Standard Library Controls](#standard-library-controls)
    - [`lua.loadCore()`](#lualoadcore)
    - [`lua.loadIo()`](#lualoadio)
  - [Memory & Garbage Collection](#memory--garbage-collection)
    - [`lua.totalMemory()`](#luatotalmemory)
    - [`lua.gcCollect()`](#luagccollect)
    - [`lua.gcMetrics()`](#luagcmetrics)
- [Class: `Globals`](#class-globals)
  - [`globals.get(name)`](#globalsgetname)
  - [`globals.set(name, value)`](#globalssetname-value)
- [Class: `Executor`](#class-executor)
  - [`executor.step(lua, fuel)`](#executorsteplua-fuel)
  - [`executor.takeResult(lua)`](#executortakeresultlua)
- [Interface: `GcMetrics`](#interface-gcmetrics)

---

## Overview

The `Lua` class represents an isolated Lua 5.4 Virtual Machine instance running natively inside Node.js via NAPI. Global variables (`_ENV` / `ctx.globals()`) are accessed through the `Globals` handle returned by `lua.globals()`.

---

## Class: `Lua`

### Constructors & Factories

* `new Lua()` / `Lua.full()`: Creates a VM with full stdlib (including I/O).
* `Lua.core()`: Creates a VM with core stdlib (no I/O).
* `Lua.empty()`: Creates an empty VM for strict sandboxing.

---

### Globals Handle

#### `lua.globals()`
* **Signature**: `globals(): Globals`
* **Description**: Returns the [`Globals`](#class-globals) handle for interacting with global variables (`_ENV` / `ctx.globals()`), mirroring Ottavino's Rust API.
* **Example**:
  ```typescript
  const globals = lua.globals();
  globals.set("appName", "MyService");
  console.log(globals.get("appName")); // "MyService"
  ```

---

### Execution & Stepping

#### `lua.eval(code)`
* **Signature**: `eval(code: string): unknown`
* **Description**: Evaluates Lua code to completion and converts return values to JavaScript.

#### `lua.executor(code)`
* **Signature**: `executor(code: string): Executor`
* **Description**: Creates a step-driven `Executor` handle to step through script execution with fuel budgets.

---

### Convenience Aliases

* `lua.getGlobal(name: string): unknown`: Alias for `lua.globals().get(name)`.
* `lua.setGlobal(name: string, value: unknown): void`: Alias for `lua.globals().set(name, value)`.
* `lua.registerCallback(name: string, callback: Function): void`: Alias for `lua.globals().set(name, callback)`.

---

## Class: `Globals`

The `Globals` class mirrors Ottavino's `ctx.globals()` API in Rust.

#### `globals.get(name)`
* **Signature**: `get(name: string): unknown`
* **Parameters**:
  * `name`: `string` — The name of the global variable to retrieve.
* **Returns**: `unknown` — The converted JavaScript value.

#### `globals.set(name, value)`
* **Signature**: `set(name: string, value: unknown): void`
* **Parameters**:
  * `name`: `string` — The name of the global variable to set.
  * `value`: `unknown` — The JavaScript value (primitive, object, array, or function) to bind.
* **Note**: Passing a JavaScript function automatically converts it into a callable Ottavino `Callback` in Lua!

---

## Class: `Executor`

#### `executor.step(lua, fuel)`
* **Signature**: `step(lua: Lua, fuel: number): boolean`
* **Description**: Steps execution consuming up to `fuel` units. Returns `true` when complete.

#### `executor.takeResult(lua)`
* **Signature**: `takeResult(lua: Lua): unknown`
* **Description**: Retrieves the return value of execution once `step()` returns `true`.

---

## Interface: `GcMetrics`

```typescript
export interface GcMetrics {
  totalAllocation: number;
  allocationDebt: number;
}
```
