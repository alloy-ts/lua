# API Reference: Ottavino Crate vs. NAPI Bindings

This document provides a complete reference for the NAPI bindings exported by `@lib/module` (`dist/index.js` / `index.js`), detailing the mapping between the underlying Rust **`ottavino`** crate primitives and our JavaScript/TypeScript NAPI interface.

---

## 1. Ottavino Crate Primitives vs. NAPI Binding Coverage

| Ottavino Crate Type / API | Description in Ottavino | Exposed NAPI Binding / Method | Status |
| :--- | :--- | :--- | :--- |
| **`ottavino::Lua`** | Top-level VM instance managing the garbage collection arena. | `Lua` class (`Lua.full()`, `Lua.core()`, `Lua.empty()`) | **Covered** |
| **`ottavino::Context<'gc>`** | Execution context providing access to globals, registry, and string interner. | Wrapped internally during NAPI calls (`setGlobal`, `getGlobal`, `eval`). | **Covered** |
| **`ottavino::Executor`** | VM execution engine that steps through Lua closures. | Driven inside `eval()` via `Executor::start` and `finish`. | **Covered** |
| **`ottavino::StashedExecutor`** | GC root handle for `Executor` across collection cycles. | Managed internally when running `Lua::finish` / `eval`. | **Covered** |
| **`ottavino::Value`** | Enum representing Lua data types (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). | Automatic conversion to/from JS primitives (`number`, `string`, `boolean`, `null`/`undefined`) and objects -> tables. | **Covered** |
| **`ottavino::Table`** | Garbage-collected associative array table. | JS Objects are converted to/from Lua tables in `setGlobal` / `eval`. | **Covered** |
| **`ottavino::Closure`** | Compiled Lua function prototype bound to an environment. | Compiled & executed via `Closure::load` inside `eval()`. | **Covered** |
| **`ottavino::Fuel`** | Step counter for bounding VM execution duration. | Configured internally during `Lua::finish` execution steps. | **Covered** |
| **`ottavino::Callback`** | Host functions implemented in Rust. | Internal stdlib callbacks preloaded in `full()` & `core()`. | **Covered** |
| **`ottavino::Thread`** | Lua coroutine execution context. | Accessible in Lua via `coroutine` library in `full()` & `core()`. | **Covered** |
| **`gc_arena::Metrics`** | Garbage collection allocator statistics. | Exposed via `lua.gcMetrics()` and `lua.totalMemory()`. | **Covered** |

---

## 2. NAPI API Reference

### `Lua` Class

The primary class for creating, configuring, and executing embedded Lua environments in Node.js.

#### Constructors

##### `Lua.full(): Lua`
Instantiates a Lua VM with the full standard library loaded (base, coroutine, math, string, table, I/O).

##### `Lua.core(): Lua`
Instantiates a Lua VM with core standard libraries loaded (`math`, `string`, `table`, `coroutine`, base functions), isolated from system I/O capabilities.

##### `Lua.empty(): Lua`
Instantiates an empty, bare-bones Lua VM with no standard libraries preloaded.

---

#### Methods

##### Code Execution
###### `lua.eval(code: string): unknown`
Compiles and executes the given Lua code string, returning the evaluated result as a native JavaScript value (`number`, `string`, `boolean`, or `undefined` for `nil`).
- **Parameters:**
  - `code`: `string` — The Lua code string or expression.
- **Returns:** `unknown` — The converted return value.
- **Throws:** Throws a JavaScript `Error` on syntax or execution errors.

##### Global Variable Management
###### `lua.setGlobal(name: string, value: unknown): void`
Sets a global variable or constant in the Lua VM environment from a JS primitive or object. Plain JS objects are recursively converted into Lua tables.
- **Parameters:**
  - `name`: `string` — Variable name.
  - `value`: `unknown` — Value (`number`, `string`, `boolean`, `null`/`undefined`, or plain `object`).

###### `lua.getGlobal(name: string): unknown`
Retrieves a global variable from the Lua VM environment, converting it into a JS primitive value.
- **Parameters:**
  - `name`: `string` — Variable name to retrieve.
- **Returns:** `unknown` — The primitive JS value or `undefined` if unset/nil.

##### Standard Library Management
###### `lua.loadCore(): void`
Loads core standard libraries (`math`, `string`, `table`, `coroutine`, base) into an existing Lua state.

###### `lua.loadIo(): void`
Loads I/O standard libraries into an existing Lua state.

##### Memory & Garbage Collection
###### `lua.totalMemory(): number`
Returns the total memory used by the Lua VM in bytes.

###### `lua.gcCollect(): void`
Triggers a full garbage collection cycle in the Lua VM.

###### `lua.gcMetrics(): GcMetrics`
Returns garbage collector metrics.
- **Returns:** `GcMetrics` (`{ totalAllocation: number, allocationDebt: number }`)

---

## 3. Helper Functions & Interfaces

### `evalLua(code: string): unknown`
Convenience helper function from `src/main.ts` that instantiates a full Lua VM and evaluates the provided Lua script string.

### `GcMetrics` Interface

```typescript
export interface GcMetrics {
  totalAllocation: number; // Total bytes tracked by GC allocator
  allocationDebt: number;  // Current GC allocation debt
}
```
