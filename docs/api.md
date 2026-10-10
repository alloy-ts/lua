# API Reference

The primary export of `@alloy-ts/lua` is the `Lua` class. It exposes a sandboxed Lua 5.4 execution environment powered by the [Ottavino](https://github.com/kyren/ottavino) pure-Rust VM (derived from Piccolo and `gc-arena`) and exposed via NAPI.

```typescript
import { Lua } from "@alloy-ts/lua";
```

---

## API Coverage Summary

Every public method exposed by the native Ottavino binding is fully mapped into TypeScript:

* **Constructors & Factories**: `new Lua()`, `Lua.full()`, `Lua.core()`, `Lua.empty()`
* **Code Execution & Stepping**: `lua.eval(code)`, `lua.createExecutor(code)`, `lua.stepExecutor(executor, fuel)`
* **Global Variable Management**: `lua.setGlobal(name, value)`, `lua.getGlobal(name)`
* **Host Callback Registration**: `lua.registerCallback(name, jsFunction)`
* **Standard Library Management**: `lua.loadCore()`, `lua.loadIo()`
* **Memory & Garbage Collection**: `lua.totalMemory()`, `lua.gcCollect()`, `lua.gcMetrics()`

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

### Code Execution & Step Executors

#### `lua.eval(code: string): unknown`
Compiles and executes a string of Lua code. Returns the result as a JavaScript value converted from the returned Lua value.

```typescript
const sum = lua.eval("return 10 + 20"); // 30
```

#### `lua.createExecutor(code: string): LuaExecutor`
Compiles Lua code and returns a handle to a step-by-step executor for paused/paced execution.

```typescript
const executor = lua.createExecutor("return 100 + 200");
```

#### `lua.stepExecutor(executor: LuaExecutor, fuelAmount: number): { done: boolean; value?: unknown }`
Steps the given executor forward by up to `fuelAmount` VM instruction steps.

```typescript
const res = lua.stepExecutor(executor, 50);
if (res.done) {
  console.log("Result:", res.value); // 300
}
```

---

### Global Variable & Host Callback Management

#### `lua.setGlobal(name: string, value: unknown): void`
Binds a JavaScript value as a global variable in the Lua environment.

```typescript
lua.setGlobal("appName", "AlloyApp");
lua.setGlobal("config", { port: 8080, active: true });
```

#### `lua.getGlobal(name: string): unknown`
Retrieves a global variable from the Lua environment by name.

```typescript
const appName = lua.getGlobal("appName"); // "AlloyApp"
```

#### `lua.registerCallback(name: string, callback: (...args: any[]) => any): void`
Registers a JavaScript host function into the Lua global scope as a callable Ottavino `Callback`.

```typescript
lua.registerCallback("addJS", (a: number, b: number) => a + b);
const res = lua.eval("return addJS(5, 10)"); // 15
```

---

### Standard Library Management

#### `lua.loadCore(): void`
Loads core standard libraries (base, coroutine, math, string, table) into an existing `Lua` instance.

#### `lua.loadIo(): void`
Loads the I/O standard library into an existing `Lua` instance.

---

### Memory & Garbage Collection

#### `lua.totalMemory(): number`
Returns the total memory currently allocated and tracked by the Lua VM in bytes.

#### `lua.gcCollect(): void`
Triggers a full garbage collection cycle in the Lua VM.

#### `lua.gcMetrics(): GcMetrics`
Returns a snapshot of GC metrics (`{ totalAllocation: number, allocationDebt: number }`).

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
