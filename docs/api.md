# API Documentation for `@alloy-ts/lua`

The `@alloy-ts/lua` package provides a high-performance JavaScript/TypeScript interface to a pure Rust Lua 5.4 execution environment (`ottavino` / `piccolo`) compiled via [NAPI-RS](https://napi.rs/).

---

## Table of Contents

- [Core Ottavino Types & NAPI Exposure Matrix](#core-ottavino-types--napi-exposure-matrix)
- [Exported Classes & Interfaces](#exported-classes--interfaces)
  - [`Lua`](#lua)
  - [`Globals`](#globals)
  - [`LuaExecutor`](#luaexecutor)
  - [`LuaThread`](#luathread)
  - [`StepResult`](#stepresult)
  - [`GcMetrics`](#gcmetrics)
- [Value Conversion Rules](#value-conversion-rules)
- [Cross-Boundary Exception & Error Conversion](#cross-boundary-exception--error-conversion)

---

## Core Ottavino Types & NAPI Exposure Matrix

The table below summarizes how each of the 13 core Ottavino Rust types is handled in the `@alloy-ts/lua` NAPI bridge:

| Ottavino Rust Type | NAPI Class / Conversion in JS/TS | Exposure & Role |
| -------------------- | ------------------------------- | --------------- |
| **`Lua`** | `class Lua` | Top-level VM owner and GC arena host. |
| **`Context<'gc>`** | Managed internally in Rust closures | GC mutation and string interning context passed to VM operations. |
| **`Executor`** | `class LuaExecutor` | Step-driven trampoline VM runner pacing bytecode execution with fuel. |
| **`StashedExecutor`** | Managed inside `LuaExecutor` | Arena-safe handle referencing a paused or active `Executor` across `Lua::enter` calls. |
| **`Value<'gc>`** | JS Primitives / Objects / Arrays | Bidirectionally marshaled enum (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). |
| **`Table<'gc>`** | JS `Object` or `Array` | Converted to sequential JS Arrays (if 1-indexed sequence) or plain JS Objects. |
| **`Closure<'gc>`** | Executed in VM / `eval` | Compiled Lua function prototype bound to an environment upvalue table. |
| **`Fuel`** | Passed into `executor.step(fuel)` | Step counter pacing instruction limits to guarantee bounded execution time. |
| **`Callback<'gc>`** | Used internally for host calls | Rust function wrapper implementing `CallbackFn` or `Sequence`. |
| **`Thread<'gc>`** | `class LuaThread` | Coroutine thread handle exposing `resume()` and `status()`. |
| **`Stack<'gc>`** | Managed internally in callbacks | Value argument and return stack for VM function calls. |
| **`UserData<'gc>`** | String placeholder (`"[lua userdata]"`) | Host-allocated custom Rust userdata buffer. |
| **`Metrics`** | `interface GcMetrics` | Snapshot metrics from the `gc-arena` memory allocator. |

---

## Exported Classes & Interfaces

### `Lua`

The `Lua` class represents an isolated Lua VM state.

#### Constructors & Factory Methods

- **`new Lua()`**: Creates a new Lua instance with the full standard library loaded (base, coroutine, math, string, table, I/O).
- **`Lua.full()`**: Creates a Lua instance with full standard libraries pre-loaded.
- **`Lua.core()`**: Creates a sandboxed Lua instance with core libraries loaded (omitting file/system I/O).
- **`Lua.empty()`**: Creates an empty, highly sandboxed Lua instance with **no** standard libraries loaded.

#### Evaluation & Execution

- **`lua.eval(code: string): unknown`**: Compiles and executes the given Lua code string, returning converted JS result.
- **`lua.globals(): Globals`**: Returns a `Globals` handle for interacting with global variables (`_ENV`).
- **`lua.setGlobal(name: string, value: unknown): void`**: Binds a JS primitive, array, object, or JS function into the Lua global environment (delegates to `globals().set()`).
- **`lua.getGlobal(name: string): unknown`**: Retrieves a global variable from the Lua VM as a converted JS value (delegates to `globals().get()`).
- **`lua.executor(code: string): LuaExecutor`**: Creates a step-driven `LuaExecutor` wrapper.
- **`lua.createThread(codeOrFnName: string): LuaThread`**: Creates a suspended Lua coroutine `LuaThread` handle.
- **`lua.loadCore(): void`**: Loads core standard libraries into an existing instance.
- **`lua.loadIo(): void`**: Loads I/O standard libraries into an existing instance.
- **`lua.totalMemory(): number`**: Returns total memory used by the VM in bytes.
- **`lua.gcCollect(): void`**: Runs a full garbage collection cycle.
- **`lua.gcMetrics(): GcMetrics`**: Returns allocator memory metrics.

---

### `Globals`

Provides direct access to global variables in the Lua environment (`_ENV`).

- **`globals.get(name: string): unknown`**: Retrieves a global variable from the Lua environment by name.
- **`globals.set(name: string, value: unknown): void`**: Binds a global variable in the Lua environment. Converts primitives, JS arrays/objects into Lua tables, and JS functions into callable Lua `Callback` objects.

```typescript
const globals = lua.globals();
globals.set("appName", "My App");
globals.set("addNumbers", (a: number, b: number) => a + b);

console.log(globals.get("appName")); // "My App"
console.log(lua.eval("return addNumbers(10, 20)")); // 30
```

---

### `LuaExecutor`

Exposes step-driven execution paced by fuel units.

- **`executor.step(fuelAmount: number): StepResult`**: Executes up to `fuelAmount` VM instruction steps.
- **`executor.isDone(): boolean`**: Returns whether execution has completed.

```typescript
const executor = lua.executor("local sum = 0; for i = 1, 1000 do sum = sum + i end; return sum");
let done = false;
while (!done) {
  const res = executor.step(100);
  done = res.done;
  if (done) console.log("Final Result:", res.value);
}
```

---

### `LuaThread`

Exposes control over Lua coroutine threads.

- **`thread.resume(args?: unknown[]): unknown`**: Resumes the coroutine thread with optional arguments.
- **`thread.status(): string`**: Returns current thread status (`"normal"`, `"suspended"`, `"running"`, or `"dead"`).

```typescript
const thread = lua.createThread("myCoroutine");
const yieldVal = thread.resume();
```

---

### `StepResult`

```typescript
export interface StepResult {
  /** True if execution completed or errored */
  done: boolean;
  /** Return value on completion */
  value?: unknown;
}
```

---

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

## Value Conversion Rules

### Lua → JavaScript

| Lua Value Type | Returned JavaScript Value Type | Note / Representation |
| -------------- | ----------------------------- | --------------------- |
| `nil` | `undefined` | Unset or nil values map to `undefined` |
| `boolean` | `boolean` | `true` or `false` |
| `integer` | `number` | Converted to JS float/int number |
| `float` | `number` | Converted to JS number |
| `string` | `string` | UTF-8 decoded string |
| `table` (sequential) | `Array` | 1-indexed sequential tables become 0-indexed JS Arrays |
| `table` (keyed/hash) | `Object` | Keyed table entries become JS Object properties |
| `function` | `string` | Returned as `"[lua function]"` placeholder |
| `thread` | `string` | Returned as `"[lua thread]"` placeholder |
| `userdata` | `string` | Returned as `"[lua userdata]"` placeholder |

### JavaScript → Lua

| JavaScript Value Type | Converted Lua Value Type | Note / Representation |
| --------------------- | ------------------------ | --------------------- |
| `undefined` / `null` | `nil` | Maps directly to Lua `nil` |
| `boolean` | `boolean` | `true` or `false` |
| `number` (integer) | `integer` | Numbers with zero fractional component fit in `i64` |
| `number` (float) | `number` | Floating-point numbers |
| `string` | `string` | String interned in Lua VM |
| `Array` | `table` | Converted to 1-indexed sequential table |
| `Object` | `table` | Plain objects converted to string-keyed hash table |
| `Function` | `function` (`Callback`) | Converted to an `ottavino::Callback`, callable directly inside Lua code |

---

## Cross-Boundary Exception & Error Conversion

When an exception or error occurs across the JS/TS ↔ Lua boundary:

1. **Lua Compile / Syntax Errors**:
   - **Trigger**: Syntax error or unparseable chunk passed to `lua.eval()`, `lua.executor()`, or `lua.createThread()`.
   - **Conversion**: Rust converts `CompilerError` into a NAPI JS `Error` instance with message `"Lua compile error: <details>"`.

2. **Lua Runtime Errors**:
   - **Trigger**: Explicit calls to `error('msg')`, type errors (e.g. attempting to index `nil`), or math errors in Lua code.
   - **Conversion**: Trapped inside Ottavino's `Executor` and converted into a NAPI JS `Error` with message `"Lua runtime error: <details>"`.

3. **Trapping Errors inside Lua**:
   - Lua code can use the built-in `pcall(function, args...)` function to catch errors inside Lua without bubbling a NAPI JS exception to host code.

```typescript
try {
  lua.eval("error('Database failure!')");
} catch (err: any) {
  console.log(err.message); // "Lua runtime error: lua error: Database failure!"
}
```
