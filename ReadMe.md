# Embedded Lua for TypeScript/JavaScript (via NAPI)

Embed a Lua 5.4 execution environment into TypeScript and JavaScript applications by exporting Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM implementation) to safely expose Lua's API to Node.js and JavaScript environments without external native C dependencies.

## Key Features

- **Full Lua 5.4 Environment**: Create sandboxed Lua states with empty, core, or full standard libraries.
- **Stackless VM Architecture**: Reifies execution state into heap structures driven by polling (`Executor::step`), enabling bounded execution and pre-emptive time slicing.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives, objects, and arrays.
- **Global Variable Binding**: Get and set global variables in the Lua VM directly from TS/JS.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`), inspect allocation metrics (`gcMetrics()`), and manually trigger garbage collection (`gcCollect()`).

## Quick Usage Example

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

## API Summary

- `Lua.full()` / `new Lua()`: Creates a VM with full stdlib (including I/O).
- `Lua.core()`: Creates a VM with core stdlib (no I/O).
- `Lua.empty()`: Creates an empty VM for strict sandboxing.
- `lua.eval(code: string): unknown`: Evaluates Lua code and converts return value to TS/JS.
- `lua.setGlobal(name, value)` / `lua.getGlobal(name)`: Bidirectional variable getter/setter.
- `lua.loadCore()` / `lua.loadIo()`: Dynamically loads standard library modules.
- `lua.totalMemory()` / `lua.gcCollect()` / `lua.gcMetrics()`: Memory tracking & GC controls.

For detailed documentation, see:
- [API Reference (`docs/api.md`)](./docs/api.md)
- [Lua 5.4 & Ottavino Language Guide (`docs/lang-guide.md`)](./docs/lang-guide.md)

## Examples

Check the [`examples/`](./examples/) folder for runnable TypeScript examples:
- [`examples/variables.ts`](./examples/variables.ts): Defining primitive variables, constants, objects, and metatables.
- [`examples/primitives.ts`](./examples/primitives.ts): Working with numbers, strings, booleans, and nulls.
- [`examples/object.ts`](./examples/object.ts): Table/object manipulation and OOP patterns.
- [`examples/function.ts`](./examples/function.ts): Defining and invoking Lua functions.
- [`examples/memory.ts`](./examples/memory.ts): Memory tracking and garbage collection controls.
- [`examples/stdlib.ts`](./examples/stdlib.ts): Sandboxing and standard library loading.

Run any example using `@oxc-node/core`:
```bash
node --import @oxc-node/core/register examples/variables.ts
```

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
