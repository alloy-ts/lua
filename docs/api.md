# Ottavino & @alloy-ts/lua API Documentation and Implementation Review

This document provides a comprehensive reference for the **Ottavino** Rust crate API, details how `@alloy-ts/lua` exposes this functionality to JavaScript/TypeScript via NAPI-RS, and evaluates whether all Ottavino APIs are covered in the current implementation.

---

## Executive Summary & Overview

> **API Alignment with Ottavino:**
>
> `@alloy-ts/lua` exposes the Lua VM through a high-level JS/TS API centered around the `Lua` class (`eval`, `globals()`, library loading, and GC memory management).
>
> To align closely with Ottavino's Rust API (`ctx.globals().get(...)` / `ctx.globals().set(...)`), `@alloy-ts/lua` provides the **`Globals`** class via `lua.globals()` for interacting with global variables (`_ENV`). When JavaScript functions are assigned via `globals().set("fnName", fn)` or `setGlobal("fnName", fn)`, they are converted into native Ottavino **`Callback`** instances that Lua scripts can call directly.

---

## 1. Ottavino Rust Crate API Reference

[Ottavino](https://github.com/kyren/ottavino) is a pure Rust implementation of a stackless Lua 5.4 VM built on `gc-arena`. Below is a breakdown of the primary types and modules provided by the `ottavino` crate:

### 1.1 `Lua` (`ottavino::Lua`)

The primary entry point for managing a Lua VM instance and garbage-collected arena.

- **Constructors**:
  - `Lua::full()`: Instantiates a VM with all standard libraries (base, coroutine, math, string, table, and I/O print capabilities) loaded.
  - `Lua::core()`: Instantiates a VM with core standard libraries loaded (no I/O / print).
  - `Lua::empty()`: Instantiates an empty Lua VM with no standard libraries.
- **Standard Library Management**:
  - `lua.load_core()`: Loads core libraries into an existing Lua state.
  - `lua.load_io()`: Loads I/O libraries (e.g. `print`) into an existing Lua state.
- **Memory & Garbage Collection**:
  - `lua.total_memory(): usize`: Returns total memory allocated by the VM in bytes.
  - `lua.gc_collect()`: Triggers a full garbage collection cycle.
  - `lua.gc_metrics(): GcMetrics`: Returns GC metrics (`total_allocation()`, `allocation_debt()`).
- **Execution & Lifetime Management**:
  - `lua.enter(|ctx| ...)`: Enters the GC arena, providing a `Context<'gc>` to allocate and manipulate Lua values safely.
  - `lua.finish(&stashed_executor)`: Steps a stashed `Executor` to completion.

---

### 1.2 `Globals` & Global Environment (`_ENV`)

Interacting with the Lua global environment table (`ctx.globals()`).

- **`ctx.globals().get_raw(key)`**: Retrieves a global variable by key.
- **`ctx.globals().set(ctx, key, value)`**: Sets a global variable in `_ENV`.

In `@alloy-ts/lua`, `lua.globals()` mirrors `ctx.globals()`:

- **`lua.globals().get(name)`**: Gets a global variable from Lua.
- **`lua.globals().set(name, value)`**: Binds a global variable in Lua. Primitives, objects, and arrays are converted to Lua types, while JS functions are converted into callable Ottavino `Callback`s.

---

### 1.3 `Executor` & `Execution` (`ottavino::Executor`, `ottavino::Execution`)

Ottavino uses a stackless executor to manage Lua thread execution and callback resumes.

- **`Executor::start(ctx, function, args)`**: Starts executing a Lua `Function` or `Thread` with provided arguments.
- **`executor.step(ctx)`**: Steps execution forward by a single VM cycle or bytecode step.
- **`executor.mode()`**: Returns current status (`ExecutorMode::Pending`, `ExecutorMode::Result`, etc.).
- **`executor.take_result::<T>(ctx)`**: Takes the final result or runtime error once execution has finished.
- **`Execution<'gc, '_>`**: Execution context passed into callbacks or sequences during execution.

---

### 1.4 `Thread` (`ottavino::Thread`)

Represents a Lua coroutine (thread of execution).

- **`Thread::new(mc)`**: Creates a new thread/coroutine in the GC arena.
- Represented as `Value::Thread(Thread<'gc>)` inside Lua.
- Manages execution frames, call stacks, and coroutine status (`suspended`, `running`, `dead`).

---

### 1.5 `Callback`, `Sequence`, and `AsyncCallback`

Allows host functions implemented in Rust/JS to be called from Lua.

- **`Callback<'gc>`**: A garbage-collected reference to a host function implementing `CallbackFn`.
  - `Callback::from_fn(mc, fn)`: Wraps a function `Fn(Context, Execution, Stack) -> Result<CallbackReturn, Error>`.
  - `Callback::from_fn_with(mc, root, fn)`: Wraps a function associated with a GC root object (used in `@alloy-ts/lua` to wrap `FunctionRef` JS callbacks).
- **`CallbackReturn<'gc>`**: Enum describing what the executor should do after a callback returns (`Return`, `Call`, `Yield`, `Resume`, `Sequence`).
- **`Sequence<'gc>`**: A stateful, multi-step callback trait (`poll`, `error`) allowing asynchronous, step-by-step execution within the VM.

---

### 1.6 `Stack` (`ottavino::Stack`)

Provides a slice-like view of arguments and return values during callback and sequence execution.

- **Methods**:
  - `stack.get(idx)` / `stack.get_value(idx)`: Reads values from the call stack.
  - `stack.push(val)`: Pushes a value onto the stack.
  - `stack.replace(...)`: Replaces values on the stack (used during host callback execution to place return values).

---

### 1.7 `Closure` & `FunctionPrototype` & `Function`

Represents executable Lua bytecode and functions.

- **`FunctionPrototype<'gc>`**: Compiled Lua bytecode prototype containing opcodes, constants, upvalues, and sub-prototypes.
  - `FunctionPrototype::compile(ctx, source_name, source)`: Parses and compiles raw Lua code into a prototype.
- **`Closure<'gc>`**: A `FunctionPrototype` bound to environment upvalues (`_ENV`).
  - `Closure::new(mc, proto, env)`: Creates a new closure.
  - `Closure::load(ctx, name, source)`: Compiles Lua source code and binds it with global environment `ctx.globals()`.
- **`Function<'gc>`**: Enum wrapping either `Function::Closure(Closure)` or `Function::Callback(Callback)`.

---

### 1.8 `Value` (`ottavino::Value`)

The tagged union representing all direct Lua variables.

```rust
pub enum Value<'gc> {
    Nil,
    Boolean(bool),
    Integer(i64),
    Number(f64),
    String(String<'gc>),
    Table(Table<'gc>),
    Function(Function<'gc>),
    Thread(Thread<'gc>),
    UserData(UserData<'gc>),
}
```

---

## 2. `@alloy-ts/lua` API Reference

The TypeScript package `@alloy-ts/lua` wraps Ottavino via NAPI-RS (`src/lua.rs`).

### 2.1 JS `Lua` & `Globals` Class Methods

```typescript
import { Lua, Globals, GcMetrics } from "@alloy-ts/lua";

// Constructors / Factories
const lua = Lua.full(); // or new Lua(), Lua.core(), Lua.empty()

// Globals API (aligned with Ottavino ctx.globals())
const globals: Globals = lua.globals();

// Read and set global variables
globals.set("multiplier", 10);
const multiplier = globals.get("multiplier"); // 10

// Register a JS function as a callable Lua function
globals.set("add", (a: number, b: number) => a + b);
const sum = lua.eval("return add(15, 25)"); // 40

// Convenience aliases on Lua instance
lua.setGlobal("key", "val");
const key = lua.getGlobal("key");

// Memory and GC Metrics
const memBytes = lua.totalMemory();
lua.gcCollect();
const metrics: GcMetrics = lua.gcMetrics();
```

---

### 2.2 JS <-> Lua Value Conversion Table

| Lua Type (`Value<'gc>`)         | JS Return Type (`eval` / `globals().get`) | JS to Lua Conversion (`globals().set`)       |
| :------------------------------ | :---------------------------------------- | :------------------------------------------- |
| `Nil`                           | `undefined`                               | `undefined` / `null`                         |
| `Boolean`                       | `boolean`                                 | `boolean`                                    |
| `Integer` / `Number`            | `number`                                  | `number` (integer if whole, float otherwise) |
| `String`                        | `string`                                  | `string`                                     |
| `Table` (sequential length > 0) | `Array` (1-based array elements)          | `Array` (converted to 1-indexed Lua table)   |
| `Table` (keyed)                 | `Object` (plain JS key-value object)      | `Object` (converted to keyed Lua table)      |
| `Function`                      | `"[lua function]"` (placeholder string)   | JS `Function` -> Ottavino `Callback`         |
| `Thread`                        | `"[lua thread]"` (placeholder string)     | _Unimplemented_                              |
| `UserData`                      | `"[lua userdata]"` (placeholder string)   | _Unimplemented_                              |

---

## 3. Implementation Review & Gap Analysis

Below is a module-by-module review comparing the Ottavino Rust crate against `@alloy-ts/lua`:

| Component / Concept    | Ottavino Rust API                                                                                           | `@alloy-ts/lua` JS API Status | Gap / Notes                                                                                                |
| :--------------------- | :---------------------------------------------------------------------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **`Lua` Instance**     | `full()`, `core()`, `empty()`, `load_core()`, `load_io()`, `total_memory()`, `gc_collect()`, `gc_metrics()` | **Covered**                   | Exposed via class `Lua` and static factory methods.                                                        |
| **`Globals` / `_ENV`** | `ctx.globals().get_raw(...)`, `ctx.globals().set(...)`                                                      | **Covered (`lua.globals()`)** | Mirrors Ottavino `Globals` API with `.get()` and `.set()`.                                                 |
| **Code Execution**     | `Closure::load`, `Executor::start`, `finish`, `take_result`                                                 | **Covered (`eval`)**          | Evaluates Lua code synchronously, returning converted JS primitives or objects.                            |
| **`Callback` (JS Fn)** | `Callback::from_fn_with`, `CallbackFn`, `CallbackReturn`                                                    | **Covered**                   | JS functions passed to `globals().set()` or `setGlobal()` are registered as callable Ottavino `Callback`s. |
| **GC & Memory**        | `total_memory()`, `gc_collect()`, `gc_metrics()`                                                            | **Covered**                   | Full memory monitoring and garbage collection triggers exposed.                                            |
| **`Value` Primitives** | `Nil`, `Boolean`, `Integer`, `Number`, `String`                                                             | **Covered**                   | Seamless bidirectional conversion between JS primitives and Lua types.                                     |
| **`Value::Table`**     | `Table::new`, `get`, `set`, `length`, `iter`                                                                | **Partially Covered**         | JS objects and arrays are converted by deep copying. No handle for in-place table mutation or metatables.  |
| **`Sequence`**         | `Sequence`, `SequencePoll`                                                                                  | **Unexposed**                 | Asynchronous multi-step host callbacks are unexposed to JS.                                                |
| **`Stack`**            | `Stack` (`get`, `push`, `pop`, `replace`)                                                                   | **Internal Only**             | Used internally during callback execution; not exposed as a raw JS handle.                                 |
| **`Thread`**           | `Thread` (coroutines: `create`, `resume`, `yield`)                                                          | **Unexposed**                 | Coroutines are accessible within Lua scripts, but cannot be directly controlled from JS.                   |
| **`Closure`**          | `Closure::load`, `Closure::new`, `FunctionPrototype`                                                        | **Internal Only**             | Used inside `eval()`. Pre-compiled bytecode handles cannot be saved or reused in JS.                       |
| **`UserData`**         | `UserData::new`, metatable attachment                                                                       | **Unexposed**                 | Host JS objects/classes cannot be bound as native Lua UserData objects.                                    |
| **Metatables**         | `set_metatable`, `metatable`                                                                                | **Unexposed**                 | Metatables cannot be configured on tables or values directly from JS.                                      |
