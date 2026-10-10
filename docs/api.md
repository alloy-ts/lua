# API Reference

This document describes the API exported from `dist/index.js` and `@lib/module` for embedding Lua in TypeScript/JavaScript via NAPI.

## Exports Overview

From `dist/index.js` (and `@lib/module`):

- **Classes / Structs:**
  - `Lua`: The main execution environment for running Lua code.
  - `LuaExecutor`: Bounded stepping executor handle created via `lua.executor(code)`.
  - `Context`: Internal bridge handle to an active garbage collector mutation context.
  - `Function`: Opaque handle to a Lua function prototype.
  - `RuntimeError`: Shareable wrapper around a Rust runtime error.
  - `ExternError`: Error object representing an unhandled Lua or runtime error across FFI boundaries.

---

## `Lua` Class

Top-level class representing a Lua 5.4 execution environment.

### Constructors & Factories

- [`Lua.empty(): Lua`](#luaempty-lua)
- [`Lua.core(): Lua`](#luacore-lua)
- [`Lua.full(): Lua`](#luafull-lua)

### Methods

- [Code Execution](#code-execution)
  - [`lua.eval(code: string): string`](#luaevalcode-string-string)
  - [`lua.executor(code: string): LuaExecutor`](#luaexecutorcode-string-luaexecutor)
- [Global Variable Management](#global-variable-management)
  - [`lua.setGlobal(key: string, value: string): void`](#luasetglobalkey-string-value-string-void)
  - [`lua.getGlobal(name: string): string`](#luagetglobalname-string-string)
- [Standard Library Management](#standard-library-management)
  - [`lua.loadCore(): void`](#lualoadcore-void)
  - [`lua.loadIo(): void`](#lualoadio-void)
- [Memory & Garbage Collection](#memory--garbage-collection)
  - [`lua.totalMemory(): number`](#luatotalmemory-number)
  - [`lua.gcCollect(): void`](#luagccollect-void)
  - [`lua.gcMetrics(): GcMetrics`](#luagcmetrics-gcmetrics)

---

### Method Details

#### `lua.eval(code: string): string`

Compiles and evaluates a Lua code snippet, returning the string representation of the result value. Throws a JavaScript `Error` if compilation or execution fails.

#### `lua.executor(code: string): LuaExecutor`

Compiles the given Lua code and returns a `LuaExecutor` handle for bounded step-by-step execution.

#### `lua.setGlobal(key: string, value: string): void`

Sets a global string variable in the Lua environment.

#### `lua.getGlobal(name: string): string`

Retrieves a global variable from the Lua environment as a display string.

---

## `LuaExecutor` Class

Handle to an active Lua execution frame that can be stepped with fuel limits.

### Methods

#### `exec.step(lua: Lua, fuelLimit: number): boolean`

Steps execution by up to `fuelLimit` VM units.

- **Returns:** `true` if execution has completed, `false` if more fuel is required.

#### `exec.takeResult(lua: Lua): string`

Retrieves the result string after `exec.step` returns `true`.
