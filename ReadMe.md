# Lua

> Embed a Lua execution environment into TypeScript and JavaScript applications using Lua's API via NAPI and pure-Rust VM (Ottavino / Piccolo).

This library uses [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM implementation derived from Piccolo and `gc-arena`) to safely expose Lua's API to Node.js and JavaScript environments without external native C dependencies or memory corruption risks.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or full standard libraries.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives, objects, and arrays.
- **Global Variable Binding**: Get and set global variables in the Lua VM directly from JS/TS.
- **Stackless & Resilient Architecture**: Powered by Ottavino's stackless interpreter design for safe sandboxing and polling.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`), allocator debt (`gcMetrics()`), and manually trigger garbage collection (`gcCollect()`).

## Architecture & Design Highlights

Unlike C-based Lua embeddings (PUC-Rio Lua or LuaJIT), this library is built on **Ottavino** (derived from **Piccolo**), a pure, mostly safe Rust implementation of Lua 5.4.

Key architectural benefits include:

- **Stackless Interpreter Design**: The VM state is reified as a data structure rather than relying on the native C/Rust function call stack. Execution progress is driven by polling and stepping fuel.
- **Immediate Cancellation & Pacing**: Long-running or infinite loops in untrusted Lua code can be safely interrupted or bounded without destroying process state or longjmping past native stacks.
- **True Garbage Collection (`gc-arena`)**: Uses `gc-arena` for precise tracing garbage collection without raw pointers or reference cycle leaks.
- **Symmetric Coroutines (`coroutine.yieldto`)**: Supports direct symmetric coroutine transfers without stack accumulation or tail-call leaks.

For deep architectural details, see [docs/architecture.md](docs/architecture.md).

## Usage Example

```typescript
import { Lua } from "@lib/module";

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

## Documentation

- [API Reference](docs/api.md) — Detailed TypeScript methods, types, and error handling.
- [Language & Stdlib Guide](docs/lang-guide.md) — Lua 5.4 syntax, standard library modules, and sandboxing subsets.
- [Architecture & Design Guide](docs/architecture.md) — In-depth overview of Piccolo/Ottavino's stackless VM design, `gc-arena`, fuel pacing, and coroutines.

## API Reference Overview

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with the full standard library loaded (base, coroutine, math, string, table, I/O).
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code string, returning the result as a JavaScript value.
- `lua.setGlobal(name: string, value: unknown): void`: Sets a global variable in the Lua VM environment.
- `lua.getGlobal(name: string): unknown`: Retrieves a global variable from the Lua VM environment.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics (`totalAllocation`, `allocationDebt`).

## Development

- Install dependencies:

```bash
npm install
```

- Run unit tests:

```bash
npm test
```

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
