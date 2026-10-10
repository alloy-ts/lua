# API Reference: `@alloy-ts/lua`

The `@alloy-ts/lua` package exposes a Node.js NAPI binding to an embedded Lua 5.4 VM instance backed by [Ottavino](https://github.com/kyren/ottavino) (formerly Piccolo).

---

## High-Level Overview & Covered NAPI Bindings

The JavaScript/TypeScript wrapper binds to Ottavino's Rust API via NAPI.

### Covered NAPI Surface Area

- **Constructors & Factories:** `new Lua()`, `Lua.full()`, `Lua.core()`, `Lua.empty()`
- **Code Execution:** `lua.eval(code)`
- **Global Environment Management:** `lua.setGlobal(name, value)`, `lua.getGlobal(name)`
- **Standard Library Loading:** `lua.loadCore()`, `lua.loadIo()`
- **Memory & Garbage Collection:** `lua.totalMemory()`, `lua.gcCollect()`, `lua.gcMetrics()`

---

## Ottavino Crate Core Architecture & Types Mapping

Below is a direct comparison showing how Ottavino's core Rust types are abstracted and exposed in the NAPI binding (`@alloy-ts/lua`):

| Ottavino Rust Crate Type | NAPI Binding (`@alloy-ts/lua`) | Architectural Role & Details                                                                                                      |
| :----------------------- | :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `ottavino::Lua`          | `class Lua`                    | Main Lua VM container managing state, garbage collection, and global tables.                                                      |
| `ottavino::Executor`     | Managed in `lua.eval()`        | Stackless VM runner. `eval()` instantiates an `Executor` and steps it to completion.                                              |
| `ottavino::Thread`       | Managed internally             | Coroutine/thread execution context managed by `Executor`.                                                                         |
| `ottavino::Closure`      | Managed in `lua.eval()`        | Compiled Lua bytecode chunk (`Closure::load()`).                                                                                  |
| `ottavino::Callback`     | Managed in stdlib (`loadIo`)   | Native function written in Rust (`Callback::from_fn`) registered as a Lua global.                                                 |
| `ottavino::Function`     | Returned as `"[lua function]"` | Enum of `Closure` or `Callback`. Surfaced to JS as placeholder string.                                                            |
| `ottavino::Value`        | JS Primitive / Array / Object  | Tagged enum representing Lua values (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`). |
| `ottavino::Stack`        | Managed in `eval()`            | Call argument/return stack evaluated during VM step.                                                                              |
| `ottavino::Table`        | JS `Object` / `Array`          | Associative array table converted to JS Array (if sequence length > 0) or Object.                                                 |
| `ottavino::Context`      | Managed in `lua.enter()`       | GC arena context required for table mutations and interning.                                                                      |
| `ottavino::Fuel`         | Managed internally in `eval()` | Execution budget counter driving the stackless VM loop.                                                                           |
| `ottavino::GcMetrics`    | `interface GcMetrics`          | Exposed via `lua.gcMetrics()`.                                                                                                    |

---

## API Documentation

### Class: `Lua`

The primary class representing a sandboxed, isolated Lua VM execution environment.

```typescript
import { Lua } from "@alloy-ts/lua";
```

---

### Constructors & Factories

#### `new Lua()`

- **Returns:** `Lua`
- **Description:** Instantiates a new Lua VM instance with the full standard library (`base`, `coroutine`, `math`, `string`, `table`, `I/O`) loaded. Equivalent to `Lua.full()`.

#### `Lua.full()`

- **Returns:** `Lua`
- **Description:** Creates a Lua VM instance loaded with the full standard library (including I/O and `print`).

#### `Lua.core()`

- **Returns:** `Lua`
- **Description:** Creates a Lua VM instance loaded with core standard libraries (`base`, `coroutine`, `math`, `string`, `table`), excluding I/O.

#### `Lua.empty()`

- **Returns:** `Lua`
- **Description:** Creates an empty, fully sandboxed Lua VM instance with no standard libraries loaded.

---

### Instance Methods

#### `lua.eval(code: string): unknown`

- **Parameters:**
  - `code` (`string`): A string containing Lua source code to compile and evaluate.
- **Returns:** `unknown` - The converted JavaScript value returned by the evaluated Lua code.
- **Throws:**
  - `Error` if there is a Lua compilation/syntax error.
  - `Error` if there is an unhandled Lua runtime error.
- **Description:** Compiles and executes the given Lua chunk using Ottavino's stackless `Executor` and `Closure::load`.

```typescript
const result = lua.eval("return 2 + 3 * 4"); // 14
```

---

#### `lua.setGlobal(name: string, value: unknown): void`

- **Parameters:**
  - `name` (`string`): The name of the global variable to set in Lua.
  - `value` (`unknown`): The JavaScript value to convert and assign to the global variable.
- **Description:** Sets a global variable in the Lua VM environment. Converts JS primitives, objects, and arrays to corresponding `ottavino::Value` and `ottavino::Table` types.

```typescript
lua.setGlobal("userName", "Alice");
lua.setGlobal("config", { timeout: 3000, active: true });
```

---

#### `lua.getGlobal(name: string): unknown`

- **Parameters:**
  - `name` (`string`): The name of the global variable to retrieve from Lua.
- **Returns:** `unknown` - The JavaScript value converted from the Lua global.
- **Description:** Retrieves a global variable from the Lua VM environment. Returns `undefined` if the variable does not exist.

```typescript
const user = lua.getGlobal("userName"); // "Alice"
```

---

#### `lua.loadCore(): void`

- **Description:** Loads core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua VM instance.

---

#### `lua.loadIo(): void`

- **Description:** Loads the I/O standard library capabilities into an existing Lua VM instance.

---

#### `lua.totalMemory(): number`

- **Returns:** `number` - Total memory used by the Lua VM in bytes.
- **Description:** Returns the total memory currently allocated and tracked by the `gc-arena` garbage collector.

---

#### `lua.gcCollect(): void`

- **Description:** Triggers an explicit full garbage collection cycle inside the Lua VM.

---

#### `lua.gcMetrics(): GcMetrics`

- **Returns:** `GcMetrics`
- **Description:** Returns current garbage collector metrics.

```typescript
interface GcMetrics {
  totalAllocation: number; // Total bytes tracked by allocator
  allocationDebt: number; // Current allocation debt
}
```

---

## Value Conversion Matrix

| JS / TS Type             | Lua Type (`ottavino::Value`) | Notes                                        |
| :----------------------- | :--------------------------- | :------------------------------------------- |
| `number` (integer value) | `Value::Integer`             | JS integers mapped to 64-bit integers in Lua |
| `number` (float value)   | `Value::Number`              | Mapped to double-precision float in Lua      |
| `string`                 | `Value::String`              | UTF-8 string interned in VM `Context`        |
| `boolean`                | `Value::Boolean`             | `true` / `false`                             |
| `undefined` / `null`     | `Value::Nil`                 | Mapped to Lua `nil`                          |
| `Array`                  | `Value::Table` (sequential)  | Mapped to 1-indexed Lua array table          |
| `Object`                 | `Value::Table` (keyed)       | Mapped to Lua key-value table                |
| Lua `function`           | `Value::Function`            | Returned to JS as `"[lua function]"` string  |
| Lua `thread`             | `Value::Thread`              | Returned to JS as `"[lua thread]"` string    |
| Lua `userdata`           | `Value::UserData`            | Returned to JS as `"[lua userdata]"` string  |
