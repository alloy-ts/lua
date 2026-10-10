# Lua

> Stackless Lua VM for JavaScript.

`@alloy-ts/lua` uses [NAPI-RS](https://napi.rs/) and
[Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM
implementation) to safely expose Lua's API to Node.js and JavaScript
environments without external native C dependencies.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or
  full standard libraries.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives,
  objects, and arrays.
- **Global Variable Binding**: Access and bind global variables (`_ENV`) via `globals().get()` and `globals().set()`.
- **JS Callbacks in Lua**: Pass JavaScript functions to `globals().set()` to execute JS functions directly from Lua with full error propagation (`pcall`/`xpcall`).
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`) and
  manually trigger garbage collection (`gcCollect()`).

## Usage Example

```typescript
import { Lua } from "@alloy-ts/lua";

// Create a Lua instance with standard libraries loaded
const lua = Lua.full();

// Evaluate Lua expressions and scripts
const result = lua.eval("return 1 + 2 * 3");
console.log(result); // 7

const greeting = lua.eval("return 'Hello, ' .. 'Lua!'");
console.log(greeting); // "Hello, Lua!"

// Access globals via lua.globals()
const globals = lua.globals();

// Set global variables from JS/TS
globals.set("multiplier", 10);
globals.set("data", { name: "Lua", active: true });

// Register JS callbacks callable from Lua
globals.set("add", (a: number, b: number) => a + b);

// Read global variables and use JS callbacks in Lua code
console.log(globals.get("multiplier")); // 10
const calculated = lua.eval("return add(multiplier, 5)");
console.log(calculated); // 15

// Working with Lua tables (returned as JS objects or arrays)
const arrayResult = lua.eval("return { 10, 20, 30 }");
console.log(arrayResult); // [10, 20, 30]

// Check memory usage and trigger garbage collection
console.log(`Memory used: ${lua.totalMemory()} bytes`);
lua.gcCollect();
```

## API Reference

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with standard libraries loaded.
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded.
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code
  string, returning the result as a JavaScript value.
- `lua.globals(): Globals`: Returns the `Globals` handle for interacting with global variables (`_ENV`), mirroring Ottavino's Rust API.
  - `globals.get(name: string): unknown`: Retrieves a global variable from the Lua environment.
  - `globals.set(name: string, value: unknown): void`: Binds a global variable in the Lua environment. Converts primitives, JS objects/arrays to Lua tables, and JS functions to callable Ottavino `Callback`s.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua
  state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua
  VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics.

### Value Conversion

Results of `eval` and values read via `globals().get` are converted from Lua values
to JavaScript as follows:

| Lua value            | JavaScript value                        |
| -------------------- | --------------------------------------- |
| `nil`                | `undefined`                             |
| `boolean`            | `boolean`                               |
| `integer`            | `number`                                |
| `float`              | `number`                                |
| `string`             | `string`                                |
| `table` (sequential) | `Array`                                 |
| `table` (keyed)      | `Object`                                |
| `function`           | `"[lua function]"` (placeholder string) |
| `thread`             | `"[lua thread]"` (placeholder string)   |
| `userdata`           | `"[lua userdata]"` (placeholder string) |

Conversely, `globals().set` converts JavaScript `undefined`/`null` → `nil`,
`boolean` → `boolean`, integer-valued `number` → Lua `integer` (otherwise
`number`), `string` → `string`, `Array` → sequential `table`, plain `Object`
→ keyed `table`, and `Function` → callable Ottavino `Callback`.

## Development

- Install dependencies:

```bash
npm install
```

- Build native addon:

```bash
npm run build
```

- Run unit tests:

```bash
npm test
```
