# API Reference: `@alloy-ts/lua`

The `@alloy-ts/lua` package exposes a Node.js NAPI binding to an embedded Lua 5.4 VM instance backed by [Ottavino](https://github.com/kyren/ottavino).

---

## Exports

### `Lua`

The primary class representing a sandboxed, isolated Lua VM execution environment.

```typescript
import { Lua } from "@alloy-ts/lua";
```

---

## Constructors & Factories

### `new Lua()`

- **Returns:** `Lua`
- **Description:** Instantiates a new Lua VM instance with the full standard library (base, coroutine, math, string, table, and I/O) pre-loaded. Equivalent to `Lua.full()`.

### `Lua.full()`

- **Returns:** `Lua`
- **Description:** Creates a Lua VM instance loaded with the full standard library (including I/O and `print`).

### `Lua.core()`

- **Returns:** `Lua`
- **Description:** Creates a Lua VM instance loaded with core standard libraries (`base`, `coroutine`, `math`, `string`, `table`), excluding I/O.

### `Lua.empty()`

- **Returns:** `Lua`
- **Description:** Creates an empty, fully sandboxed Lua VM instance with no standard libraries loaded.

---

## Instance Methods

### `lua.eval(code: string): unknown`

- **Parameters:**
  - `code` (`string`): A string containing Lua source code to compile and evaluate.
- **Returns:** `unknown` - The converted JavaScript value returned by the evaluated Lua code.
- **Throws:**
  - `Error` if there is a Lua compilation/syntax error.
  - `Error` if there is an unhandled Lua runtime error.
- **Description:** Compiles and executes the given Lua chunk. If the code returns a value, it is automatically converted to its JavaScript equivalent.

```typescript
const result = lua.eval("return 2 + 3 * 4"); // 14
```

---

### `lua.setGlobal(name: string, value: unknown): void`

- **Parameters:**
  - `name` (`string`): The name of the global variable to set in Lua.
  - `value` (`unknown`): The JavaScript value to convert and assign to the global variable.
- **Description:** Sets a global variable in the Lua VM environment. Converts JS primitives, objects, and arrays to corresponding Lua values and tables.

```typescript
lua.setGlobal("userName", "Alice");
lua.setGlobal("config", { timeout: 3000, active: true });
```

---

### `lua.getGlobal(name: string): unknown`

- **Parameters:**
  - `name` (`string`): The name of the global variable to retrieve from Lua.
- **Returns:** `unknown` - The JavaScript value converted from the Lua global.
- **Description:** Retrieves a global variable from the Lua VM environment. Returns `undefined` if the variable does not exist.

```typescript
const user = lua.getGlobal("userName"); // "Alice"
```

---

### `lua.loadCore(): void`

- **Description:** Loads the core standard libraries (`base`, `coroutine`, `math`, `string`, `table`) into an existing Lua VM instance. Useful when starting from `Lua.empty()`.

---

### `lua.loadIo(): void`

- **Description:** Loads the I/O standard library capabilities into an existing Lua VM instance.

---

### `lua.totalMemory(): number`

- **Returns:** `number` - Total memory used by the Lua VM in bytes.
- **Description:** Returns the total memory currently allocated and tracked by the Lua VM garbage collector.

---

### `lua.gcCollect(): void`

- **Description:** Triggers an explicit full garbage collection cycle inside the Lua VM.

---

### `lua.gcMetrics(): GcMetrics`

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

| JS / TS Type             | Lua Type             | Notes                                        |
| :----------------------- | :------------------- | :------------------------------------------- |
| `number` (integer value) | `integer`            | JS integers mapped to 64-bit integers in Lua |
| `number` (float value)   | `number`             | Mapped to double-precision float in Lua      |
| `string`                 | `string`             | UTF-8 string                                 |
| `boolean`                | `boolean`            | `true` / `false`                             |
| `undefined` / `null`     | `nil`                | Mapped to Lua `nil`                          |
| `Array`                  | `table` (sequential) | Mapped to 1-indexed Lua array table          |
| `Object`                 | `table` (keyed)      | Mapped to Lua key-value table                |
| Lua `function`           | `string`             | Returned to JS as `"[lua function]"` string  |
| Lua `thread`             | `string`             | Returned to JS as `"[lua thread]"` string    |
| Lua `userdata`           | `string`             | Returned to JS as `"[lua userdata]"` string  |
