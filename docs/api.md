# Ottavino API & `@alloy-ts/lua` Binding Documentation

This document provides a comprehensive review of the `@alloy-ts/lua` NAPI bindings and compares them with the underlying pure-Rust [Ottavino](https://github.com/kyren/ottavino) VM crate API.

---

## 1. `@alloy-ts/lua` JavaScript / TypeScript API Reference

The `@alloy-ts/lua` library wraps the Ottavino Lua 5.4 VM using NAPI-RS.

### Constructors

- **`new Lua()` / `Lua.full(): Lua`**
  Instantiates a Lua VM with the standard library loaded (base, coroutine, math, string, table, and print from I/O).

- **`Lua.core(): Lua`**
  Instantiates a Lua VM with core standard libraries loaded (base, coroutine, math, string, table) without I/O (`print`).

- **`Lua.empty(): Lua`**
  Instantiates an empty Lua VM with no standard libraries loaded.

### Instance Methods

#### Code Execution

- **`lua.eval(code: string): unknown`**
  Compiles and executes the given Lua code string within the VM context and returns the result converted to a JavaScript value.
  - _Throws:_ `Error` on syntax/compile errors (e.g. `Lua compile error: ...`) or runtime errors (e.g. `Lua runtime error: ...`).

#### Global Variable Management

- **`lua.setGlobal(name: string, value: unknown): void`**
  Binds a global variable in the Lua VM environment (`_ENV` / `globals()`).
  - Primitive values (`number`, `string`, `boolean`, `null`, `undefined`) are mapped directly.
  - Objects and arrays are converted into Lua tables.
  - **Functions (`Function`)**: Registered as callable Ottavino `Callback` objects in Lua. When invoked from Lua, arguments on the Lua stack are converted to JS values, passed to the JS function, and the returned JS value is pushed back onto the Lua stack.

- **`lua.getGlobal(name: string): unknown`**
  Retrieves a global variable from the Lua VM environment and converts it to its corresponding JavaScript representation.

#### Standard Library Management

- **`lua.loadCore(): void`**
  Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua state.

- **`lua.loadIo(): void`**
  Loads the I/O standard library component (`print`) into an existing Lua state.

#### Memory & Garbage Collection

- **`lua.totalMemory(): number`**
  Returns the total memory used by the Lua VM in bytes (tracks both `Gc` managed pointers and external allocations).

- **`lua.gcCollect(): void`**
  Triggers a full garbage collection cycle in the Lua VM (`mark_all` -> `finalize` -> `collect_all`).

- **`lua.gcMetrics(): GcMetrics`**
  Returns snapshot GC metrics:
  - `totalAllocation`: total allocated bytes.
  - `allocationDebt`: current allocation debt.

### Type Definitions

```typescript
export interface GcMetrics {
  totalAllocation: number;
  allocationDebt: number;
}
```

---

## 2. JavaScript <-> Lua Value Conversion

| Lua Value Type       | JavaScript Equivalent | Notes                                                                      |
| :------------------- | :-------------------- | :------------------------------------------------------------------------- |
| `nil`                | `undefined`           | `undefined` or `null` converted to `nil` in `setGlobal`.                   |
| `boolean`            | `boolean`             | Direct primitive mapping.                                                  |
| `integer`            | `number`              | Mapped to JS `number`. Integer-valued JS numbers convert to Lua `integer`. |
| `number`             | `number`              | Mapped to JS `number`.                                                     |
| `string`             | `string`              | UTF-8 lossy conversion from interned Lua strings.                          |
| `table` (sequential) | `Array`               | Arrays with length > 0 map to JS arrays (1-indexed in Lua).                |
| `table` (keyed)      | `Object`              | Keyed tables map to plain JS objects.                                      |
| `function`           | `"[lua function]"`    | JS functions passed via `setGlobal` become callable `Callback`s in Lua.    |
| `thread`             | `"[lua thread]"`      | Placeholder string.                                                        |
| `userdata`           | `"[lua userdata]"`    | Placeholder string.                                                        |

---

## 3. Error Handling & Exception Propagation

1. **Lua Syntax / Compile Errors**:
   Occur when evaluating syntactically invalid Lua code. Throws a JavaScript `Error` with prefix `Lua compile error: ...`.

2. **Lua Runtime Errors**:
   Occur when Lua code calls `error(...)` or performs invalid operations (e.g., calling a non-function). Throws a JavaScript `Error` with prefix `Lua runtime error: ...`.

3. **JS Function Callback Exceptions**:
   - **Caught in Lua**: When a registered JS function throws an exception during Lua execution, Lua's `pcall` / `xpcall` can catch it. `pcall` returns `false` and the error message as a string.
   - **Uncaught in Lua**: If the exception is not caught by `pcall` within Lua, it propagates out of `lua.eval()` and throws a JavaScript `Error` containing the original JS exception message.

---

## 4. Ottavino Crate Architecture & Internal Primitives

Ottavino is a stackless, garbage-collected Lua 5.4 VM written in pure Rust built upon `gc-arena`.

### Core Rust Types

1. **`Value<'gc>`**

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

   Represents all Lua data types.

2. **`Context<'gc>`**
   Provides access to the `Mutation` arena handle, `globals()` table, `registry()`, string interner, and finalizers.

3. **`Executor<'gc>` & `StashedExecutor`**
   Ottavino's stackless execution mechanism. An `Executor` wraps a `Thread` and can be stepped with `Fuel` units (`executor.step(ctx, &mut fuel)`). `StashedExecutor` allows storing an executor safely across arena mutations in `Registry`.

4. **`Thread<'gc>`**
   Represents a Lua coroutine/thread state containing its own stack, status, and execution frame stack.

5. **`Callback<'gc>` & `Sequence<'gc>`**
   - `Callback`: Rust-implemented host function callable from Lua.
   - `CallbackReturn`: Dictates executor action after callback invocation (`Return`, `Sequence`, `Call`, `Yield`, `Resume`).
   - `Sequence`: Async/step-driven state machine polled by the executor.

6. **`Closure<'gc>` & `FunctionPrototype`**
   Lua bytecode functions bound to environment upvalues (`_ENV`).

7. **`Stack<'gc, '_>`**
   Resizable value stack used for function call arguments and return values.

8. **`Table<'gc>` & `UserData<'gc>`**
   Garbage-collected hash/array tables and arbitrary Rust host user data with metatables.

---

## 5. Feature Gap Analysis & Implementation Roadmap

Comparing our NAPI bindings against Ottavino's capabilities:

### Currently Implemented

- [x] Basic VM lifecycle (`empty`, `core`, `full`, stdlib loading).
- [x] Uninterrupted execution via `lua.eval()`.
- [x] Global variables get/set (`setGlobal`, `getGlobal`).
- [x] Host function callbacks via `setGlobal(name, jsFn)`.
- [x] Exception propagation between JS and Lua.
- [x] GC metrics & explicit collection (`totalMemory`, `gcCollect`, `gcMetrics`).
- [x] Primitive and nested array/object value marshalling.

### Unimplemented Features & Proposed Extensions

#### 1. Step Execution / Driven Executor (`lua.executor(code)`)

- **Ottavino Primitive:** `Executor::start`, `executor.step(ctx, &mut fuel)`, `Fuel`.
- **Use Case:** Pausing execution, resource bounds, timeout prevention, cancellable scripts, REPL demos.
- **JS Design:**
  ```typescript
  class LuaExecutor {
    step(fuel: number): { done: boolean; result?: unknown };
  }
  ```

#### 2. Coroutine / Thread API

- **Ottavino Primitive:** `Thread<'gc>`, `coroutine.resume`, `coroutine.yield`.
- **Use Case:** Exposing `Thread` objects to JS rather than `"[lua thread]"` strings, allowing JS to resume and yield Lua coroutines.
