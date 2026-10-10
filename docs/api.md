# API Reference: Ottavino Crate vs. NAPI Bindings

This document provides a comprehensive comparison between the low-level Rust **`ottavino`** (formerly Piccolo) crate primitives and our JavaScript/TypeScript NAPI interface exported by `@lib/module` (`dist/index.js` / `index.js`).

---

## 1. Ottavino Crate Primitives vs. NAPI Binding Mapping

| Ottavino Crate Primitives | Description in Ottavino | NAPI Interface / Mapping | Coverage Status |
| :--- | :--- | :--- | :--- |
| **`ottavino::Lua`** | Top-level VM state managing the garbage-collection arena (`gc-arena`). | `Lua` class (`Lua.full()`, `Lua.core()`, `Lua.empty()`) | **Exposed** |
| **`ottavino::Context<'gc>`** | Execution context handle for interning strings, fetching globals, and querying registry. | Managed internally within NAPI enter callbacks. | **Encapsulated** |
| **`ctx.globals()`** | Access handle for standard global table (`_ENV`). | `lua.globals(): Globals` (`globals.get(lua, name)`, `globals.set(lua, name, val)`). | **Exposed via `lua.globals()`** |
| **`ottavino::Executor`** | VM engine driving thread execution step-by-step. | Encapsulated in `lua.eval(code)`, driven to completion via `finish`. | **Encapsulated** |
| **`ottavino::StashedExecutor`** | GC-rooted handle for `Executor` across collection cycles. | Retained internally during script evaluation. | **Encapsulated** |
| **`ottavino::Value`** | Enum representing Lua types (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). | Automatically converted to/from native JS primitives (`number`, `string`, `boolean`, `undefined`) and JS objects -> Lua tables. | **Exposed via JS Conversion** |
| **`ottavino::Table`** | Garbage-collected associative table. | JS Objects are converted into `OTable` instances in `globals.set(lua, name, val)`. | **Exposed via JS Objects** |
| **`ottavino::Closure`** | Compiled Lua function closure bound to an environment. | Compiled & loaded via `Closure::load` inside `eval()`. | **Encapsulated** |
| **`ottavino::Fuel`** | Step counter for pacing or bounding VM execution. | Managed internally within `Lua::finish` execution steps. | **Encapsulated** |
| **`ottavino::Callback`** | Host functions written in Rust. | Standard library callbacks preloaded in `full()` & `core()` constructors. | **Encapsulated** |
| **`ottavino::Thread`** | Coroutine execution thread state. | Usable in Lua code via `coroutine` library (`coroutine.create`, `resume`, `yield`). | **Exposed via Lua Coroutines** |
| **`ottavino::Stack`** | Stack frame storage for function call parameters and returns. | Managed internally during closure/executor execution. | **Encapsulated** |
| **`ottavino::UserData`** | Host-provided opaque data bound to Lua GC. | Internal VM data structures. | **Encapsulated** |
| **`gc_arena::Metrics`** | Garbage collection memory statistics. | Exposed via `lua.gcMetrics()` (`GcMetrics`) and `lua.totalMemory()`. | **Exposed** |

---

## 2. Error Handling & Exception Boundaries

When evaluating Lua code via `lua.eval(code)`:
- **Syntax Errors**: If the Lua parser encounters invalid syntax, a native JavaScript `Error` is thrown (`parse error`).
- **Runtime Errors**: If Lua encounters an unhandled runtime error (e.g., `error("msg")`, `assert(false)`, or type mismatch operations), the underlying Rust `ottavino::Error` is intercepted and thrown as a native JavaScript `Error`.
- **Coroutine Thread Errors**: Errors inside coroutines resumed via `coroutine.resume(co)` are caught as protected calls inside Lua, returning `false, "error message"`. Unhandled thread errors escaping top-level evaluation are caught by NAPI and thrown as JavaScript `Error` instances.
- **JS try/catch**: You can wrap `lua.eval(...)` calls in JavaScript `try { ... } catch (err) { ... }` blocks to catch Lua errors seamlessly.
- **Native Lua pcall/xpcall**: Within Lua scripts, errors can be caught natively using `pcall(fn)` or `xpcall(fn, msgh)`.

---

## 3. NAPI API Specification

### `Lua` Class

The primary interface for instantiating and controlling embedded Lua environments in Node.js.

#### Constructors

- **`Lua.full(): Lua`**
  Instantiates a Lua VM with the full standard library loaded (base, coroutine, math, string, table, I/O).

- **`Lua.core(): Lua`**
  Instantiates a Lua VM with core standard libraries loaded (`math`, `string`, `table`, `coroutine`, base functions), completely isolated from system file/device I/O.

- **`Lua.empty(): Lua`**
  Instantiates an empty Lua VM with no standard libraries preloaded. Secure sandbox for pure expression evaluation.

---

#### Methods

##### Code Execution
- **`lua.eval(code: string): unknown`**
  Compiles and executes the given Lua script or expression string, returning the result as a native JavaScript value (`number`, `string`, `boolean`, or `undefined` for `nil`).

##### Global Variable Management
- **`lua.globals(): Globals`**
  Returns the `Globals` handle for interacting with global variables (`_ENV` / `ctx.globals()`), mirroring Ottavino's Rust API.

- **`lua.setGlobal(name: string, value: unknown): void`** *(Legacy / Forwarder)*
  Forwarder to `lua.globals().set(lua, name, value)`.

- **`lua.getGlobal(name: string): unknown`** *(Legacy / Forwarder)*
  Forwarder to `lua.globals().get(lua, name)`.

##### Standard Library Management
- **`lua.loadCore(): void`**
  Loads core standard libraries (`math`, `string`, `table`, `coroutine`, base) into an existing Lua state.

- **`lua.loadIo(): void`**
  Loads I/O standard libraries into an existing Lua state.

##### Memory & Garbage Collection
- **`lua.totalMemory(): number`**
  Returns total memory used by the Lua VM in bytes.

- **`lua.gcCollect(): void`**
  Triggers a full garbage collection cycle in the Lua VM.

- **`lua.gcMetrics(): GcMetrics`**
  Returns garbage collector metrics (`{ totalAllocation: number, allocationDebt: number }`).

---

### `Globals` Class

Handle for interacting with global environment variables (`_ENV`).

- **`globals.set(lua: Lua, name: string, value: unknown): void`**
  Binds a global variable in the Lua environment. Converts primitives (`number`, `string`, `boolean`, `null`/`undefined`) or plain JS objects (recursively into Lua tables).

- **`globals.get(lua: Lua, name: string): unknown`**
  Retrieves a global variable from the Lua environment as a native JavaScript primitive value.

---

## 4. Helper Functions & Interfaces

### `evalLua(code: string): unknown`
Helper function exported from `src/main.ts` that instantiates a full `Lua` VM and evaluates the provided Lua code string.

### `GcMetrics` Interface

```typescript
export interface GcMetrics {
  totalAllocation: number; // Total memory allocated in bytes
  allocationDebt: number;  // Current GC allocation debt
}
```
