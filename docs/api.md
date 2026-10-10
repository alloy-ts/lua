# Embedded Lua API Reference (`dist/index.js`)

This document provides a comprehensive API reference for the exported `Lua` class, `Executor` handle, and types provided by `@lib/module` (`dist/index.js` / `dist/index.d.ts`).

---

## Table of Contents

- [Overview](#overview)
- [Importing](#importing)
- [Class: `Lua`](#class-lua)
  - [Constructors & Factories](#constructors--factories)
  - [Execution & Stepping](#execution--stepping)
    - [`lua.eval(code)`](#luaevalcode)
    - [`lua.executor(code)`](#luaexecutorcode)
  - [Host Functions & Callbacks](#host-functions--callbacks)
    - [`lua.registerCallback(name, callback)`](#luaregistercallbackname-callback)
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
- [Class: `Executor`](#class-executor)
  - [`executor.step(lua, fuel)`](#executorsteplua-fuel)
  - [`executor.takeResult(lua)`](#executortakeresultlua)
- [Interface: `GcMetrics`](#interface-gcmetrics)

---

## Overview

The `Lua` class represents an isolated Lua 5.4 Virtual Machine instance running natively inside Node.js via NAPI. Execution can be run to completion using `eval()` or stepped incrementally using `Executor`.

---

## Class: `Lua`

### Constructors & Factories

* `new Lua()` / `Lua.full()`: Creates a VM with full stdlib (including I/O).
* `Lua.core()`: Creates a VM with core stdlib (no I/O).
* `Lua.empty()`: Creates an empty VM for strict sandboxing.

---

### Execution & Stepping

#### `lua.eval(code)`
* **Signature**: `eval(code: string): unknown`
* **Description**: Evaluates Lua code to completion and converts return values to JavaScript.

#### `lua.executor(code)`
* **Signature**: `executor(code: string): Executor`
* **Description**: Creates a step-driven `Executor` handle to step through script execution with fuel budgets.

---

### Host Functions & Callbacks

#### `lua.registerCallback(name, callback)`
* **Signature**: `registerCallback(name: string, callback: Function): void`
* **Description**: Registers a JavaScript function as a global Callback in the Lua environment.

---

### Global Variables & State

* `lua.setGlobal(name: string, value: unknown): void`
* `lua.getGlobal(name: string): unknown`

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
