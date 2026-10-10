# API Documentation for `@alloy-ts/lua`

The `@alloy-ts/lua` package provides a high-performance JavaScript/TypeScript interface to a pure Rust Lua 5.4 execution environment (`ottavino` / `piccolo`) compiled via [NAPI-RS](https://napi.rs/).

---

## Table of Contents

- [Overview & Rust Architecture Mapping](#overview--rust-architecture-mapping)
- [Exported Class: `Lua`](#exported-class-lua)
  - [Constructors & Factory Methods](#constructors--factory-methods)
  - [Evaluation & Execution](#evaluation--execution)
  - [Global State Binding](#global-state-binding)
  - [Executor & Thread Handle Methods](#executor--thread-handle-methods)
  - [Standard Library Loading](#standard-library-loading)
  - [Memory & Garbage Collection](#memory--garbage-collection)
- [Exported Classes & Interfaces](#exported-classes--interfaces)
  - [`LuaExecutor`](#luaexecutor)
  - [`LuaThread`](#luathread)
  - [`StepResult`](#stepresult)
  - [`GcMetrics`](#gcmetrics)
- [Value Conversion Rules](#value-conversion-rules)
- [Error & Exception Handling](#error--exception-handling)

---

## Overview & Rust Architecture Mapping

At the native layer (written in Rust in `src/lua.rs`), `@alloy-ts/lua` wraps the `ottavino` (Piccolo) Lua 5.4 VM crate:

| Ottavino (Rust) Type | NAPI Wrapper / Exposure in `@alloy-ts/lua` | Description |
| -------------------- | ------------------------------------------ | ----------- |
| `ottavino::Lua` | `export class Lua` | The top-level Lua VM owner and GC arena host. |
| `ottavino::Executor` | `export class LuaExecutor` | Step-driven trampoline VM runner pacing execution with fuel limits. |
| `ottavino::Thread` | `export class LuaThread` | Coroutine thread handle exposing `resume()` and `status()`. |
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

#### `Lua.full()`
- **Returns**: `Lua`
- Instantiates a Lua VM state with full standard libraries pre-loaded.

#### `Lua.core()`
- **Returns**: `Lua`
- Instantiates a sandboxed Lua VM state with core libraries loaded (omitting file/system I/O).

#### `Lua.empty()`
- **Returns**: `Lua`
- Instantiates an isolated Lua VM state with **no** standard libraries loaded.

---

### Evaluation & Execution

#### `lua.eval(code: string): unknown`
- Compiles and executes the given Lua code string, returning converted JS result.
- **Throws**: JavaScript `Error` on compile or runtime errors.

---

### Global State Binding

#### `lua.setGlobal(name: string, value: unknown): void`
- Binds a JS primitive, array, or object into the Lua global environment.

#### `lua.getGlobal(name: string): unknown`
- Retrieves a global variable from the Lua VM as a converted JS value.

---

### Executor & Thread Handle Methods

#### `lua.executor(code: string): LuaExecutor`
- **Parameters**: `code` (`string`): The Lua code chunk to create an executor for.
- **Returns**: `LuaExecutor`
- Creates a step-driven VM executor wrapper allowing fuel-based step execution.

#### `lua.createThread(codeOrFnName: string): LuaThread`
- **Parameters**: `codeOrFnName` (`string`): A Lua code block or global function name.
- **Returns**: `LuaThread`
- Creates a suspended Lua coroutine thread handle.

---

## Exported Classes & Interfaces

### `LuaExecutor`

Exposes step-driven execution paced by fuel units.

- **`executor.step(fuelAmount: number): StepResult`**: Executes up to `fuelAmount` VM instruction steps.
- **`executor.isDone(): boolean`**: Returns whether execution has completed.

```typescript
const executor = lua.executor("return 100 + 200");
const res = executor.step(50);
console.log(res.done, res.value); // true, 300
```

### `LuaThread`

Exposes control over Lua coroutine threads.

- **`thread.resume(args?: unknown[]): unknown`**: Resumes the coroutine thread with optional arguments.
- **`thread.status(): string`**: Returns current thread status (`"normal"`, `"suspended"`, `"running"`, or `"dead"`).

```typescript
const thread = lua.createThread("myCoroutine");
const yieldVal = thread.resume();
```

### `StepResult`

```typescript
export interface StepResult {
  /** True if execution completed or errored */
  done: boolean;
  /** Return value on completion */
  value?: unknown;
}
```

### `GcMetrics`

```typescript
export interface GcMetrics {
  /** Total bytes tracked by allocator */
  totalAllocation: number;
  /** Current allocation debt */
  allocationDebt: number;
}
```

---

## Error & Exception Handling

When an error occurs during Lua evaluation:
- **Lua Compile (Syntax) Errors**: Throws a NAPI JavaScript `Error` prefixed with `"Lua compile error:"`.
- **Lua Runtime Errors**: Explicit calls to `error('msg')` or type errors in Lua throw a NAPI JavaScript `Error` prefixed with `"Lua runtime error:"`.
- **Catching in JS/TS**: Can be caught using standard JS `try/catch` blocks.
- **Catching in Lua**: Errors inside Lua code can be trapped using Lua's built-in `pcall(fn, args...)` function.
