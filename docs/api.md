# API Reference

The primary export of `@alloy-ts/lua` is the `Lua` class. It exposes a sandboxed Lua 5.4 execution environment powered by the [Ottavino](https://github.com/kyren/ottavino) pure-Rust VM (derived from Piccolo and `gc-arena`) and exposed via NAPI.

```typescript
import { Lua } from "@alloy-ts/lua";
```

---

## Ottavino Crate API vs. NAPI Binding Coverage

Ottavino is structured around internal Rust types:
* **`Lua`**: Top-level VM instance managing the garbage collection arena (`gc-arena`).
* **`Context<'gc>`**: Execution context providing access to global variables, string interner, registry, and GC arena mutations.
* **`Value<'gc>`**: Enums representing all Lua values (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`).
* **`Executor<'gc>`**: Stackless execution state polled with `Fuel` budgets.
* **`Function<'gc>`**: Enums for closures (`Closure`) and callbacks (`Callback`).
* **`Table<'gc>`**: Associative arrays and metatables.
* **`Thread<'gc>`**: Cooperative coroutine threads.

The JavaScript/TypeScript wrapper `@alloy-ts/lua` exposes all high-level safe API operations of Ottavino via NAPI bindings:

| Ottavino Crate API | NAPI Class / Method | Description |
| --- | --- | --- |
| `Lua::full()` / `Lua::default()` | `new Lua()` / `Lua.full()` | Instantiates VM with full stdlib (base, coroutine, math, string, table, I/O). |
| `Lua::core()` | `Lua.core()` | Instantiates VM with core stdlib (no I/O). |
| `Lua::empty()` | `Lua.empty()` | Instantiates empty bare VM without stdlib. |
| `Closure::load` + `Executor::start` + `execute` | `lua.eval(code)` | Compiles, executes Lua code, and converts values to JS primitives/objects. |
| `ctx.globals().get_raw()` + `ottavino_value_to_js` | `lua.getGlobal(name)` | Retrieves global variable by name from Lua VM. |
| `js_to_ottavino_value` + `ctx.globals().set()` | `lua.setGlobal(name, value)` | Sets global variable in Lua VM from JS primitive/object/array. |
| `Lua::load_core()` | `lua.loadCore()` | Dynamically loads core standard libraries into VM. |
| `Lua::load_io()` | `lua.loadIo()` | Dynamically loads I/O standard library into VM. |
| `Lua::total_memory()` | `lua.totalMemory()` | Queries total allocated memory tracked by `gc-arena` in bytes. |
| `Lua::gc_collect()` | `lua.gcCollect()` | Triggers a full garbage collection cycle. |
| `Lua::gc_metrics()` | `lua.gcMetrics()` | Returns snapshot of GC allocation debt and total allocation metrics. |

---

## The `Lua` Class

`Lua` is a JavaScript/TypeScript class representing an isolated Lua VM instance.

### Constructors & Static Factory Methods

#### `new Lua()` or `Lua.full(): Lua`
Instantiates a new `Lua` context with the full Lua standard library loaded (base, coroutine, math, string, table, I/O).

```typescript
const lua = new Lua();
// or
const luaFull = Lua.full();
```

#### `Lua.core(): Lua`
Instantiates a new `Lua` context loaded with core standard libraries (base, coroutine, math, string, table), omitting I/O libraries.

```typescript
const luaCore = Lua.core();
```

#### `Lua.empty(): Lua`
Instantiates a bare Lua VM with no standard libraries loaded. Useful for strict sandboxing.

```typescript
const luaEmpty = Lua.empty();
```

---

### Code Execution

#### `lua.eval(code: string): unknown`
Compiles and executes a string of Lua code. Returns the result as a JavaScript value converted from the returned Lua value.

* **`code`**: Lua script or expression string.
* **Returns**: Converted JavaScript value (primitive, array, object, or `undefined`).
* **Throws**: Error if there is a Lua compile/syntax error or a runtime error during execution.

```typescript
const sum = lua.eval("return 10 + 20"); // 30
```

---

### Global Variable Management

#### `lua.setGlobal(name: string, value: unknown): void`
Binds a JavaScript value as a global variable in the Lua environment.

* **`name`**: The global variable name in Lua.
* **`value`**: The value to set (JS primitives, arrays, or plain objects).

```typescript
lua.setGlobal("appName", "AlloyApp");
lua.setGlobal("config", { port: 8080, active: true });
```

#### `lua.getGlobal(name: string): unknown`
Retrieves a global variable from the Lua environment by name.

* **`name`**: The global variable name in Lua.
* **Returns**: The converted JavaScript representation of the Lua global variable.

```typescript
const appName = lua.getGlobal("appName"); // "AlloyApp"
```

---

### Standard Library Management

#### `lua.loadCore(): void`
Loads core standard libraries (base, coroutine, math, string, table) into an existing `Lua` instance.

```typescript
const lua = Lua.empty();
lua.loadCore(); // Now string/math/table functions are available
```

#### `lua.loadIo(): void`
Loads the I/O standard library into an existing `Lua` instance.

```typescript
lua.loadIo();
```

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`
Returns the total memory currently allocated and tracked by the Lua VM in bytes.

```typescript
const bytesUsed = lua.totalMemory();
```

#### `lua.gcCollect(): void`
Triggers a full garbage collection cycle in the Lua VM.

```typescript
lua.gcCollect();
```

#### `lua.gcMetrics(): GcMetrics`
Returns a snapshot of GC metrics from the allocator.

* **Returns**: `GcMetrics` object containing `{ totalAllocation: number, allocationDebt: number }`.

```typescript
const metrics = lua.gcMetrics();
console.log(metrics.totalAllocation, metrics.allocationDebt);
```

---

## Type Conversions

### TypeScript / JS to Lua (`setGlobal`, `eval` inputs)

| JavaScript Type | Converted Lua Type | Notes |
| --- | --- | --- |
| `undefined` / `null` | `nil` | |
| `boolean` | `boolean` | |
| `number` (integer value) | `integer` | JS integers are passed as 64-bit integers |
| `number` (float) | `float` | Floating-point numbers |
| `string` | `string` | Interned as Lua strings |
| `Array` | `table` | Converted to sequential 1-indexed table |
| `Object` | `table` | Converted to keyed table |

### Lua to TypeScript / JS (`eval` return, `getGlobal`)

| Lua Type | Converted JavaScript Type | Notes |
| --- | --- | --- |
| `nil` | `undefined` | |
| `boolean` | `boolean` | |
| `integer` | `number` | |
| `float` | `number` | |
| `string` | `string` | |
| `table` (sequential) | `Array` | Converted to JS Array |
| `table` (keyed) | `Object` | Converted to plain JS Object |
| `function` | `"[lua function]"` | Placeholder string for function references |
| `thread` | `"[lua thread]"` | Placeholder string for coroutine thread references |
| `userdata` | `"[lua userdata]"` | Placeholder string for C/Rust userdata references |
