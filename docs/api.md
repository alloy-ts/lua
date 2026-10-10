# API Reference: Ottavino Crate vs. NAPI Bindings

This document provides a complete reference for the Lua NAPI bindings exported by `@lib/module` (`dist/index.js` / `index.js`), along with an architectural mapping comparing the underlying Rust **`ottavino`** (formerly Piccolo) crate APIs to the exposed NAPI methods.

---

## 1. Summary API Overview & Coverage

| Feature Category | Ottavino Rust API | NAPI Method (TypeScript / JS) | Status / Coverage |
| :--- | :--- | :--- | :--- |
| **Constructors** | `OLua::full()`, `OLua::core()`, `OLua::empty()` | `Lua.full()`, `Lua.core()`, `Lua.empty()` | **Covered** |
| **Code Execution** | `Closure::load`, `Executor::start`, `OLua::finish` | `lua.eval(code: string): unknown` | **Covered** |
| **Global Variables** | `ctx.globals().set(...)` | `lua.setGlobal(name: string, value: unknown): void` | **Covered** |
| **Global Variable Retrieval** | `ctx.globals().get_value(...)` | `lua.getGlobal(name: string): unknown` | **Covered** |
| **Standard Libraries** | `OLua::load_core()`, `OLua::load_io()` | `lua.loadCore(): void`, `lua.loadIo(): void` | **Covered** |
| **Memory Monitoring** | `OLua::total_memory()` | `lua.totalMemory(): number` | **Covered** |
| **Garbage Collection** | `OLua::gc_collect()` | `lua.gcCollect(): void` | **Covered** |
| **GC Metrics** | `OLua::gc_metrics()` | `lua.gcMetrics(): GcMetrics` | **Covered** |

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

##### [Code Execution]
###### `lua.eval(code: string): unknown`
Compiles and executes the given Lua code string, returning the evaluated result as a native JavaScript value (`number`, `string`, `boolean`, or `undefined` for `nil`).
- **Parameters:**
  - `code`: `string` — The Lua code string or expression.
- **Returns:** `unknown` — The converted return value.
- **Throws:** Throws a JavaScript `Error` on syntax or execution errors.

##### [Global Variable Management]
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

##### [Standard Library Management]
###### `lua.loadCore(): void`
Loads core standard libraries (`math`, `string`, `table`, `coroutine`, base) into an existing Lua state.

###### `lua.loadIo(): void`
Loads I/O standard libraries into an existing Lua state.

##### [Memory & Garbage Collection]
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
