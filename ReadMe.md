# Lua

> Embed a Lua execution environment into JavaScript applications
> using Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and
[Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM
implementation) to safely expose Lua's API to Node.js and JavaScript
environments without external native C dependencies.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or
  full standard libraries.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives,
  objects, and arrays.
- **Global Variable Binding**: Get and set global variables in the Lua VM
  directly from JS/TS.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`) and
  manually trigger garbage collection (`gcCollect()`).

## Examples

The [`examples/`](./examples) directory contains runnable TypeScript examples demonstrating key features:

- [`examples/object.ts`](./examples/object.ts) — Defining, passing, mutating, and binding methods to Lua objects from TS.
- [`examples/globals.ts`](./examples/globals.ts) — Handling JS/TS primitives, global variables, constants, and complex config objects in Lua.
- [`examples/function.ts`](./examples/function.ts) — Defining, calling, and inspecting Lua functions, closures, and higher-order functions from TS.
- [`examples/coroutine.ts`](./examples/coroutine.ts) / [`examples/async.ts`](./examples/async.ts) — Cooperative multitasking, yield/resume execution, and task scheduling using Lua coroutines.
- [`examples/metatable.ts`](./examples/metatable.ts) — Metatables, operator overloading, and prototype inheritance in Lua.
- [`examples/memory.ts`](./examples/memory.ts) — Memory tracking and manual garbage collection controls (`totalMemory`, `gcCollect`, `gcMetrics`).
- [`examples/stdlib.ts`](./examples/stdlib.ts) — Standard library sandboxing (`Lua.empty()`, `Lua.core()`, `Lua.full()`, `loadCore()`, `loadIo()`).

Run any example directly using Node.js:

```bash
node --import @oxc-node/core/register examples/object.ts
```

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

// Set global variables from JS/TS
lua.setGlobal("multiplier", 10);
lua.setGlobal("data", { name: "Lua", active: true });

// Read global variables and use them in Lua code
console.log(lua.getGlobal("multiplier")); // 10
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

For detailed type declarations and complete API documentation, see [docs/api.md](./docs/api.md).

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with the full standard
  library loaded (base, coroutine, math, string, table, I/O).
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no
  I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code
  string, returning the result as a JavaScript value.
- `lua.setGlobal(name: string, value: unknown): void`: Sets a global variable in
  the Lua VM environment.
- `lua.getGlobal(name: string): unknown`: Retrieves a global variable from the
  Lua VM environment.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua
  state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua
  VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics.

### Value Conversion

Results of `eval` and values read via `getGlobal` are converted from Lua values
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

Conversely, `setGlobal` converts JavaScript `undefined`/`null` → `nil`,
`boolean` → `boolean`, integer-valued `number` → Lua `integer` (otherwise
`number`), `string` → `string`, `Array` → sequential `table`, and plain `Object`
→ keyed `table`. A Lua `table` is treated as an `Array` whenever its sequential
length is greater than zero, so a table that mixes a sequence with hash keys may
lose the hash entries.

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
  JS↔Lua value conversion, global variable binding, incremental stdlib loading
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
