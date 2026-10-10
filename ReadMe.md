# Lua

> Embed a Lua execution environment into JavaScript applications
> using Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and
[Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM
implementation, forked from Piccolo) to safely expose Lua's API to Node.js and JavaScript
environments without external native C dependencies.

## Architecture & Design Highlights

Unlike traditional C-based Lua runtimes that rely on the native C call stack, Ottavino operates as a **stackless (trampoline) interpreter** powered by `gc-arena`.

Key benefits of this design include:
- **Stackless Interpreter Design:** Long-running computations and call stacks are reified into heap-allocated state machines, driven by step polling (`Executor::step`).
- **Cancellation & Sandboxing:** Execution can be safely interrupted or canceled at any time without holding the host thread hostage.
- **Pre-emptive Concurrency & Fuel Pacing:** VM execution is strictly paced by a decrementing `Fuel` budget, allowing multiple sandboxed scripts to run in a round-robin schedule without blocking the host event loop.
- **Symmetric Coroutines:** Out-of-the-box support for `coroutine.yieldto`, enabling direct coroutine jumps without stack accumulation.
- **Safe Tracing GC:** Built on `gc-arena`, maintaining safety guarantees without unsafe stack pointers.

For detailed architecture topics, read our **[Ottavino Architecture Guide](docs/ottavino-architecture.md)** and **[API Reference](docs/api.md)**.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or
  full standard libraries.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives,
  objects, and arrays.
- **Global Variable Binding**: Get and set global variables in the Lua VM
  directly from JS/TS.
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

## Examples

We provide runnable TypeScript examples demonstrating various features with `oxc-node`:

- `examples/primitives.ts` — Primitive types, JS variables, and Lua constants.
- `examples/object.ts` — Defining and manipulating Lua objects (tables) and arrays from JS/TS objects.
- `examples/variables.ts` — Comprehensive guide merging primitives, constants, variables, and nested objects.
- `examples/memory.ts` — Memory allocation tracking and GC controls (`totalMemory()`, `gcCollect()`, `gcMetrics()`).
- `examples/stdlib.ts` — Sandboxing with standard libraries (`Lua.empty()`, `Lua.core()`, `Lua.full()`, `loadCore()`, `loadIo()`).
- `examples/error.ts` — Exception and error handling between Lua and JS/TS (`try/catch` and Lua `pcall`).

Run examples using `node --import @oxc-node/core`:

```bash
node --import @oxc-node/core examples/primitives.ts
node --import @oxc-node/core examples/object.ts
node --import @oxc-node/core examples/variables.ts
node --import @oxc-node/core examples/memory.ts
node --import @oxc-node/core examples/stdlib.ts
node --import @oxc-node/core examples/error.ts
```

## API Reference

For the full comparison between Ottavino's underlying Rust crate API and the exposed NAPI bindings, see **[docs/api.md](docs/api.md)**.

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
