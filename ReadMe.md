# Lua

> Embed a Lua execution environment into JavaScript applications
> using Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and
[Ottavino](https://github.com/kyren/ottavino) / [Piccolo](https://github.com/kyren/piccolo) (a pure Rust Lua 5.4 VM
implementation) to safely expose Lua's API to Node.js and JavaScript
environments without external native C dependencies.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or
  full standard libraries.
- **Stackless Interpreter**: Powered by Ottavino/Piccolo's stackless VM architecture supporting cancellation, fuel pacing, and symmetric coroutines (`coroutine.yieldto`).
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

We provide several runnable TypeScript example scripts in the `examples/` directory:

- [`examples/primitives.ts`](examples/primitives.ts) — Defining and using Lua primitive types, constants, and variables.
- [`examples/object.ts`](examples/object.ts) — Defining and manipulating Lua objects (tables) and arrays from JS/TS objects.
- [`examples/function.ts`](examples/function.ts) — Defining and calling Lua functions, higher-order functions, and closures.
- [`examples/async.ts`](examples/async.ts) — Using Lua coroutines and integrating them with JS Promises/async workflows.
- [`examples/error.ts`](examples/error.ts) — Handling compile and runtime exceptions across TS and Lua using try/catch and `pcall`.
- [`examples/memory.ts`](examples/memory.ts) — Inspecting memory allocation and triggering garbage collection.
- [`examples/stdlib.ts`](examples/stdlib.ts) — Standard library sandboxing with `Lua.empty()`, `Lua.core()`, `Lua.full()`, `loadCore()`, and `loadIo()`.

You can run any example using `@oxc-node/core`:

```bash
node --import @oxc-node/core/register examples/primitives.ts
node --import @oxc-node/core/register examples/object.ts
node --import @oxc-node/core/register examples/function.ts
node --import @oxc-node/core/register examples/async.ts
node --import @oxc-node/core/register examples/error.ts
node --import @oxc-node/core/register examples/memory.ts
node --import @oxc-node/core/register examples/stdlib.ts
```

## Documentation

- [`docs/api.md`](docs/api.md) — Detailed JS/TS API reference for `@alloy-ts/lua` and mapping to Ottavino Rust types.
- [`docs/lang-guide.md`](docs/lang-guide.md) — Comprehensive guide covering Lua 5.4 language basics, standard library modules, Ottavino/Piccolo stackless architecture, fuel pacing, pre-emptive tasklets, symmetric coroutines (`coroutine.yieldto`), and sandboxing controls.

### Summary of `Lua` Methods

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with full standard libraries.
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.
- `lua.eval(code: string): unknown`: Executes Lua code and returns converted JS values.
- `lua.setGlobal(name: string, value: unknown): void`: Sets a global variable in the Lua VM.
- `lua.getGlobal(name: string): unknown`: Retrieves a global variable from the Lua VM.
- `lua.executor(code: string): LuaExecutor`: Creates a fuel step-driven VM executor wrapper.
- `lua.createThread(codeOrFnName: string): LuaThread`: Creates a suspended Lua coroutine thread handle.
- `lua.loadCore(): void`: Loads core standard libraries into an existing instance.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing instance.
- `lua.totalMemory(): number`: Returns memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Runs garbage collection.
- `lua.gcMetrics(): GcMetrics`: Returns memory allocator metrics.

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
