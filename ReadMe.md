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
- **Globals API & Host Callbacks**: Bind global variables (`lua.globals().get()` / `lua.globals().set()`) and register JavaScript functions that Lua code can invoke directly.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`) and
  manually trigger garbage collection (`gcCollect()`).

## Usage Example

```typescript
import { Lua } from "@alloy-ts/lua";

// Create a Lua instance with the full standard library loaded
const lua = Lua.full();

// Evaluate Lua expressions and scripts
const result = lua.eval("return 1 + 2 * 3");
console.log(result); // 7

const greeting = lua.eval("return 'Hello, ' .. 'Lua!'");
console.log(greeting); // "Hello, Lua!"

// Interacting with Globals (aligned with Ottavino's ctx.globals() API)
const globals = lua.globals();
globals.set("multiplier", 10);
globals.set("data", { name: "Lua", active: true });

// Register JavaScript functions as callable Lua callbacks
globals.set("add", (a: number, b: number) => a + b);
console.log(lua.eval("return add(multiplier, 20)")); // 30

// Read global variables
console.log(globals.get("multiplier")); // 10
const calculated = lua.eval("return data.name .. ' x' .. multiplier");
console.log(calculated); // "Lua x10"

// Working with Lua tables (returned as JS objects or arrays)
const arrayResult = lua.eval("return { 10, 20, 30 }");
console.log(arrayResult); // [10, 20, 30]

// Check memory usage and trigger garbage collection
console.log(`Memory used: ${lua.totalMemory()} bytes`);
lua.gcCollect();
```

## API Reference

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with the full standard
  library loaded (base, coroutine, math, string, table, I/O).
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no
  I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.globals(): Globals`: Returns the `Globals` handle for interacting with global variables (`_ENV`), mirroring Ottavino's `ctx.globals()` API.
  - `globals.get(name: string): unknown`: Retrieves a global variable from the Lua VM environment.
  - `globals.set(name: string, value: unknown): void`: Binds a global variable in the Lua VM environment. Primitives, objects, and arrays are converted to Lua types, and JS functions are converted to callable Lua callbacks.
- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code
  string, returning the result as a JavaScript value.
- `lua.setGlobal(name: string, value: unknown): void`: Convenience alias for `globals().set(name, value)`.
- `lua.getGlobal(name: string): unknown`: Convenience alias for `globals().get(name)`.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua
  state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua
  VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics.

### Value Conversion

Results of `eval` and values read via `globals().get()` / `getGlobal()` are converted from Lua values
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

Conversely, `globals().set()` / `setGlobal()` converts JavaScript `undefined`/`null` → `nil`,
`boolean` → `boolean`, integer-valued `number` → Lua `integer` (otherwise
`number`), `string` → `string`, `Array` → sequential `table`, plain `Object`
→ keyed `table`, and JS `Function` → callable Ottavino `Callback`.

## Development

- Install dependencies:

```bash
npm install
```

- Run unit tests:

```bash
npm test
```

The suite is split across two files:

- `src/main.test.ts` — smoke tests for the module entry point and a few core
  `eval`/`globals`/`memory` scenarios.
- `src/lua.test.ts` — the full `Lua` API coverage: constructors (`new Lua()`,
  `Lua.full()`, `Lua.core()`, `Lua.empty()`), primitive/table `eval` results,
  JS↔Lua value conversion, global variable and function callback binding, incremental stdlib loading
  (`loadCore`/`loadIo`), memory/GC controls, and error handling (compile vs.
  runtime errors).

Both files import the `Lua` class through `src/main.ts`, which in turn
re-exports it from the native binding loader. The native addon must be built
first (`npm run build`) so that the generated loader and type declarations
actually export `Lua`.

- Build the library and native add-on:

```bash
npm run build
```

- Code formatting:

```bash
npm run fmt
```

- Linting:

```bash
npm run lint
```

- Code check:

```bash
npm run check
```
