# Ottavino & @alloy-ts/lua API Documentation and Implementation Review

This document provides a comprehensive reference for the **Ottavino** Rust crate API, details how `@alloy-ts/lua` exposes this functionality to JavaScript/TypeScript via NAPI-RS, and evaluates whether all Ottavino APIs are covered in the current implementation.

---

## Executive Summary & Direct Answer

> **"Do I have them all covered?"**
>
> **No, not all Ottavino APIs are covered in `@alloy-ts/lua`.**
>
> `@alloy-ts/lua` currently provides a high-level **eval-and-globals API** centered around the `Lua` class (`eval`, `getGlobal`, `setGlobal`, library loading, and GC memory management). Under the hood, low-level Rust mechanisms like `Executor`, `Closure`, `Context`, and `Stash` are used internally to execute Lua scripts safely.
>
> However, low-level Rust VM primitives—specifically **`Executor`**, **`Thread`** (coroutines), **`Callback`** (exposing host JS functions to Lua), **`Stack`** (direct operand manipulation), **`UserData`** (binding host objects/classes into Lua), and **Metatable manipulation**—are currently **unexposed** to JavaScript/TypeScript.

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

### 1.2 `Executor` & `Execution` (`ottavino::Executor`, `ottavino::Execution`)

Ottavino uses a stackless executor to manage Lua thread execution and callback resumes.

- **`Executor::start(ctx, function, args)`**: Starts executing a Lua `Function` or `Thread` with provided arguments.
- **`executor.step(ctx)`**: Steps execution forward by a single VM cycle or bytecode step.
- **`executor.mode()`**: Returns current status (`ExecutorMode::Pending`, `ExecutorMode::Result`, etc.).
- **`executor.take_result::<T>(ctx)`**: Takes the final result or runtime error once execution has finished.
- **`Execution<'gc, '_>`**: Execution context passed into callbacks or sequences during execution.

---

### 1.3 `Thread` (`ottavino::Thread`)

Represents a Lua coroutine (thread of execution).

- **`Thread::new(mc)`**: Creates a new thread/coroutine in the GC arena.
- Represented as `Value::Thread(Thread<'gc>)` inside Lua.
- Manages execution frames, call stacks, and coroutine status (`suspended`, `running`, `dead`).

---

### 1.4 `Callback`, `Sequence`, and `AsyncCallback`

Allows host functions implemented in Rust to be called from Lua.

- **`Callback<'gc>`**: A garbage-collected reference to a Rust host function implementing `CallbackFn`.
  - `Callback::from_fn(mc, fn)`: Wraps a Rust function `Fn(Context, Execution, Stack) -> Result<CallbackReturn, Error>`.
  - `Callback::from_fn_with(mc, root, fn)`: Wraps a Rust function associated with a GC root object.
- **`CallbackReturn<'gc>`**: Enum describing what the executor should do after a callback returns:
  - `Return`: Return stack values to the caller.
  - `Call { function, then }`: Call another Lua function.
  - `Yield { to_thread, then }`: Yield values to the caller or another thread.
  - `Resume { thread, then }`: Resume a suspended thread.
  - `Sequence(BoxSequence)`: Start polling a multi-step `Sequence`.
- **`Sequence<'gc>`**: A stateful, multi-step callback trait (`poll`, `error`) allowing asynchronous, step-by-step execution, pausing, and resuming within the VM.

---

### 1.5 `Stack` (`ottavino::Stack`)

Provides a slice-like view of arguments and return values during callback and sequence execution.

- **Methods**:
  - `stack.get(idx)` / `stack.get_value(idx)`: Reads values from the call stack.
  - `stack.push(val)`: Pushes a value onto the stack.
  - `stack.pop()`: Pops a value from the stack.
  - `stack.drain()` / `stack.clear()`: Clears or drains stack frames.
  - `stack.replace(...)`: Replaces values on the stack.

---

### 1.6 `Closure` & `FunctionPrototype` & `Function`

Represents executable Lua bytecode and functions.

- **`FunctionPrototype<'gc>`**: Compiled Lua bytecode prototype containing opcodes, constants, upvalues, and sub-prototypes.
  - `FunctionPrototype::compile(ctx, source_name, source)`: Parses and compiles raw Lua code into a prototype.
- **`Closure<'gc>`**: A `FunctionPrototype` bound to environment upvalues (`_ENV`).
  - `Closure::new(mc, proto, env)`: Creates a new closure.
  - `Closure::load(ctx, name, source)`: Compiles Lua source code and binds it with global environment `ctx.globals()`.
- **`Function<'gc>`**: Enum wrapping either `Function::Closure(Closure)` or `Function::Callback(Callback)`.

---

### 1.7 `Value` (`ottavino::Value`)

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

- **Helper Methods**:
  - `val.type_name()`: Returns `"nil"`, `"boolean"`, `"number"`, `"string"`, `"table"`, `"function"`, `"thread"`, `"userdata"`.
  - `val.display()`: Printable representation.
  - `val.is_nil()`, `val.to_bool()`, `val.to_integer()`, `val.to_number()`, `val.into_string(ctx)`.

---

### 1.8 `Table` (`ottavino::Table`)

Lua key-value dictionary and array data structure.

- **Creation**: `Table::new(&ctx)`
- **Read / Write**:
  - `table.get(ctx, key)` / `table.set(ctx, key, val)`
  - `table.get_value(ctx, key)` / `table.get_raw(key)` / `table.set_raw(mc, key, val)`
- **Metadata & Iteration**:
  - `table.length()`: Sequence length.
  - `table.iter()`: Iterator over `(Value, Value)` pairs.
  - `table.metatable()` / `table.set_metatable(&ctx, metatable)`: Metatable management.

---

### 1.9 `UserData` (`ottavino::UserData`)

Enables embedding arbitrary Rust types in the Lua GC arena with custom metatables.

- `UserData::new::<Rootable![T]>(&ctx, data)`
- `userdata.metatable()` / `userdata.set_metatable(...)`

---

### 1.10 `Context`, `Stash`, and `Registry`

- **`Context<'gc>`**: Lifetime context provided during `lua.enter(|ctx| ...)`:
  - `ctx.globals()`: Accesses global `_ENV` table.
  - `ctx.intern(bytes)`: Interns byte strings into `String<'gc>`.
  - `ctx.stash(val)`: Creates a `Stash` handle to hold GC values across `lua.enter()` calls.
  - `ctx.fetch(&stashed)`: Retrieves a stashed value back into the current GC arena scope.
- **`Registry<'gc>`**: VM registry table accessible via `ctx.registry()`.

---

## 2. `@alloy-ts/lua` Current API Implementation

The TypeScript package `@alloy-ts/lua` wraps Ottavino via NAPI-RS (`src/lua.rs`).

### 2.1 JS `Lua` Class Methods

```typescript
import { Lua, GcMetrics } from "@alloy-ts/lua";

// Constructors / Factories
const luaFull = Lua.full(); // or new Lua()
const luaCore = Lua.core();
const luaEmpty = Lua.empty();

// Standard Library Loading
luaEmpty.loadCore();
luaEmpty.loadIo();

// Code Evaluation
const result = luaFull.eval("return 1 + 2");

// Global Variables
luaFull.setGlobal("myVar", 42);
const val = luaFull.getGlobal("myVar");

// Memory and GC Metrics
const memBytes = luaFull.totalMemory();
luaFull.gcCollect();
const metrics: GcMetrics = luaFull.gcMetrics();
```

---

### 2.2 JS <-> Lua Value Conversion Table

| Lua Type (`Value<'gc>`)         | JS Return Type (`eval` / `getGlobal`)   | JS to Lua Conversion (`setGlobal`)           |
| :------------------------------ | :-------------------------------------- | :------------------------------------------- |
| `Nil`                           | `undefined`                             | `undefined` / `null`                         |
| `Boolean`                       | `boolean`                               | `boolean`                                    |
| `Integer` / `Number`            | `number`                                | `number` (integer if whole, float otherwise) |
| `String`                        | `string`                                | `string`                                     |
| `Table` (sequential length > 0) | `Array` (1-based array elements)        | `Array` (converted to 1-indexed Lua table)   |
| `Table` (keyed)                 | `Object` (plain JS key-value object)    | `Object` (converted to keyed Lua table)      |
| `Function`                      | `"[lua function]"` (placeholder string) | _Unimplemented_                              |
| `Thread`                        | `"[lua thread]"` (placeholder string)   | _Unimplemented_                              |
| `UserData`                      | `"[lua userdata]"` (placeholder string) | _Unimplemented_                              |

---

## 3. Implementation Review & Gap Analysis

Below is a module-by-module review comparing the Ottavino Rust crate against `@alloy-ts/lua`:

| Component / Concept    | Ottavino Rust API                                                                                           | `@alloy-ts/lua` JS API Status           | Gap / Notes                                                                                               |
| :--------------------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **`Lua` Instance**     | `full()`, `core()`, `empty()`, `load_core()`, `load_io()`, `total_memory()`, `gc_collect()`, `gc_metrics()` | **Covered**                             | Exposed via class `Lua` and static factory methods.                                                       |
| **Code Execution**     | `Closure::load`, `Executor::start`, `finish`, `take_result`                                                 | **Covered (`eval`)**                    | Evaluates Lua code synchronously, returning converted JS primitives or objects.                           |
| **Global Variables**   | `ctx.globals().get_raw(...)`, `ctx.globals().set(...)`                                                      | **Covered (`getGlobal` / `setGlobal`)** | Bidirectional variable binding for primitive types and JSON-like objects/arrays.                          |
| **GC & Memory**        | `total_memory()`, `gc_collect()`, `gc_metrics()`                                                            | **Covered**                             | Full memory monitoring and garbage collection triggers exposed.                                           |
| **`Value` Primitives** | `Nil`, `Boolean`, `Integer`, `Number`, `String`                                                             | **Covered**                             | Seamless bidirectional conversion between JS primitives and Lua types.                                    |
| **`Value::Table`**     | `Table::new`, `get`, `set`, `length`, `iter`                                                                | **Partially Covered**                   | JS objects and arrays are converted by deep copying. No handle for in-place table mutation or metatables. |
| **`Callback`**         | `Callback::from_fn`, `CallbackFn`, `CallbackReturn`                                                         | **Unexposed**                           | Host JavaScript functions cannot currently be bound into Lua as callbacks.                                |
| **`Sequence`**         | `Sequence`, `SequencePoll`                                                                                  | **Unexposed**                           | Asynchronous multi-step host callbacks are unexposed to JS.                                               |
| **`Stack`**            | `Stack` (`get`, `push`, `pop`, `drain`)                                                                     | **Unexposed**                           | Stack manipulations are handled internally in Rust; not exposed to JS.                                    |
| **`Thread`**           | `Thread` (coroutines: `create`, `resume`, `yield`)                                                          | **Unexposed**                           | Coroutines are accessible within Lua scripts, but cannot be directly controlled from JS.                  |
| **`Closure`**          | `Closure::load`, `Closure::new`, `FunctionPrototype`                                                        | **Internal Only**                       | Used inside `eval()`. Pre-compiled bytecode handles cannot be saved or reused in JS.                      |
| **`UserData`**         | `UserData::new`, metatable attachment                                                                       | **Unexposed**                           | Host JS objects/classes cannot be bound as native Lua UserData objects.                                   |
| **Metatables**         | `set_metatable`, `metatable`                                                                                | **Unexposed**                           | Metatables cannot be configured on tables or values directly from JS.                                     |

---

## 4. Key Takeaways & Potential Future Extensions

1. **Current Capability**: `@alloy-ts/lua` is a lightweight, safe Lua 5.4 runner for JS environments. It handles basic script execution, data passing (scalars, arrays, objects), global variables, and GC control.
2. **Missing High-Value Features**:
   - **JS Callbacks**: Allowing JS functions to be passed into `setGlobal` or registered as Lua functions (e.g. `lua.setGlobal("log", (msg) => console.log(msg))`).
   - **Table Handles / In-Place Mutation**: Providing a `LuaTable` handle class to avoid copying large tables between JS and Lua.
   - **UserData & Metatables**: Allowing JS classes to be registered with custom metatables for object-oriented host bindings.
   - **Thread / Coroutine Control**: Pausing/resuming Lua coroutines step-by-step from JS.
