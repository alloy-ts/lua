# API Reference for `@alloy-ts/lua`

The `@alloy-ts/lua` library embeds a pure-Rust Lua 5.4 VM (**Ottavino**, based on **Piccolo**) into JavaScript and Node.js via NAPI-RS.

---

## Table of Contents

- [Overview](#overview)
- [Constructors & Factories](#constructors--factories)
- [Code Execution](#code-execution)
- [Global Variable Binding](#global-variable-binding)
- [Standard Library Management](#standard-library-management)
- [Memory & Garbage Collection](#memory--garbage-collection)
- [Underlying Architecture (Piccolo / Ottavino)](#underlying-architecture-piccolo--ottavino)

---

## Overview

```typescript
import { Lua, GcMetrics } from "@alloy-ts/lua";

export declare class Lua {
  constructor();
  static empty(): Lua;
  static core(): Lua;
  static full(): Lua;

  loadCore(): void;
  loadIo(): void;

  eval(code: string): unknown;
  getGlobal(name: string): unknown;
  setGlobal(name: string, value: unknown): void;

  totalMemory(): number;
  gcCollect(): void;
  gcMetrics(): GcMetrics;
}

export interface GcMetrics {
  totalAllocation: number;
  allocationDebt: number;
}
```

---

## Constructors & Factories

### `new Lua()` / `Lua.full()`
- **Signature:** `new Lua(): Lua` | `Lua.full(): Lua`
- **Description:** Instantiates a new Lua 5.4 VM with the full standard library loaded (base, coroutine, math, string, table, and I/O).

### `Lua.core()`
- **Signature:** `Lua.core(): Lua`
- **Description:** Instantiates a Lua VM with the core standard library loaded (base, coroutine, math, string, table), excluding I/O.

### `Lua.empty()`
- **Signature:** `Lua.empty(): Lua`
- **Description:** Instantiates a completely empty, sandboxed Lua VM with no standard libraries loaded.

---

## Code Execution

### `lua.eval(code: string): unknown`
- **Signature:** `lua.eval(code: string): unknown`
- **Description:** Compiles and evaluates the given Lua code string synchronously, returning the evaluated result converted into JavaScript types.
- **Type Conversions (Lua $\rightarrow$ JS):**
  - `nil` $\rightarrow$ `undefined`
  - `boolean` $\rightarrow$ `boolean`
  - `integer` / `float` $\rightarrow$ `number`
  - `string` $\rightarrow$ `string`
  - `table` (sequential 1-indexed) $\rightarrow$ `Array`
  - `table` (keyed) $\rightarrow$ `Object`
  - `function`, `thread`, `userdata` $\rightarrow$ Placeholder string (`"[lua function]"`, etc.)

---

## Global Variable Binding

### `lua.setGlobal(name: string, value: unknown): void`
- **Signature:** `lua.setGlobal(name: string, value: unknown): void`
- **Description:** Binds a global variable in the Lua VM environment. Converts JS values to Lua equivalents:
  - `undefined` / `null` $\rightarrow$ `nil`
  - `boolean` $\rightarrow$ `boolean`
  - `number` (integer-valued) $\rightarrow$ `integer`, float $\rightarrow$ `number`
  - `string` $\rightarrow$ `string`
  - `Array` $\rightarrow$ 1-indexed sequential table
  - Plain `Object` $\rightarrow$ Keyed table

### `lua.getGlobal(name: string): unknown`
- **Signature:** `lua.getGlobal(name: string): unknown`
- **Description:** Retrieves a global variable by name from the Lua environment and converts it to a JavaScript value.

---

## Standard Library Management

### `lua.loadCore(): void`
- **Signature:** `lua.loadCore(): void`
- **Description:** Loads core standard libraries (base, coroutine, math, string, table) into an existing Lua state.

### `lua.loadIo(): void`
- **Signature:** `lua.loadIo(): void`
- **Description:** Loads the I/O standard library into an existing Lua state.

---

## Memory & Garbage Collection

### `lua.totalMemory(): number`
- **Signature:** `lua.totalMemory(): number`
- **Description:** Returns total memory consumed by the Lua VM in bytes.

### `lua.gcCollect(): void`
- **Signature:** `lua.gcCollect(): void`
- **Description:** Triggers a full garbage collection cycle in the Lua VM.

### `lua.gcMetrics(): GcMetrics`
- **Signature:** `lua.gcMetrics(): GcMetrics`
- **Description:** Returns garbage collection metrics object with `totalAllocation` and `allocationDebt`.

---

## Underlying Architecture (Piccolo / Ottavino)

Ottavino is built on **Piccolo** and `gc-arena`:
1. **Stackless Interpreter**: Reifies VM execution state outside the host call stack, enabling bounded step polling, cancellation, and safe execution.
2. **Fuel-Bounded Steps**: VM execution runs step-by-step with fuel bounds to guarantee bounded time slices and prevent infinite loops from locking up host threads.
3. **Pre-emptive Concurrency**: Multiplexes multiple tasklets safely over shared VM state.
4. **Symmetric Coroutines (`coroutine.yieldto`)**: Direct mutual yielding between coroutines without call stack accumulation (tail yields).
