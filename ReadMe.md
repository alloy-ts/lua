# Embedded Lua in TypeScript/JavaScript via NAPI

This package provides native bindings to embed a Lua 5.4 engine in TypeScript / JavaScript applications using [NAPI-RS](https://napi.rs/) and [ottavino](https://crates.io/crates/ottavino).

## Architecture & How It Works

1. **NAPI-RS Bridge**: `napi-rs` generates high-performance Node.js native add-ons from Rust. It marshals data directly between V8 / JS values (`Unknown`, `Object`, primitives) and Rust data structures without manual C glue code.
2. **Pure-Rust Lua Engine**: We embed `ottavino`, a pure-Rust implementation of Lua 5.4. It manages Lua execution inside a garbage-collected arena.
3. **Value Conversion**: JS primitives (`boolean`, `number`, `string`, `null`/`undefined`) and nested objects/arrays automatically convert to corresponding Lua types (`boolean`, `number`, `string`, `nil`, and `table`) and vice-versa.
4. **Stackless Interpreter & Fuel Pacing**: Long-running Lua execution can be stepped using fuel limits (`Executor.step(fuel)`), enabling pre-emptive concurrency, cancellation, and execution pacing.

## Usage

### Basic Evaluation

```ts
import { Lua } from "@lib/module";

const lua = new Lua();

// Evaluate Lua code expressions
const sum = lua.eval("return 10 + 20"); // 30
const greeting = lua.eval("return 'Hello ' .. 'World!'"); // "Hello World!"
```

### Global Variables

```ts
const lua = new Lua();

// Set global variables from JS to Lua
lua.setGlobal("multiplier", 3);

// Access global variables inside Lua code
const result = lua.eval("return 14 * multiplier"); // 42

// Get global variables back in JS
const val = lua.getGlobal("multiplier"); // 3
```

### Registering Host JS Callbacks

```ts
const lua = new Lua();

// Register a JS function reachable from Lua scripts
lua.registerCallback("hostAdd", (a: number, b: number) => a + b);

const result = lua.eval("return hostAdd(15, 25)"); // 40
```

### Stepped Execution & Fuel Control

```ts
const lua = new Lua();

// Create a cancellable, fuel-metered executor
const exec = lua.executor(`
  local sum = 0
  for i = 1, 1000 do
    sum = sum + i
  end
  return sum
`);

// Step execution with a fuel budget
let status = exec.step(10); // { done: false, result: undefined }

// Step until completion
status = exec.step(100000); // { done: true, result: 500500 }
```

### Standard Library Flavors

```ts
// Full stdlib (includes I/O, base, coroutine, math, string, table)
const luaFull = new Lua();

// Core stdlib (non-I/O base modules)
const luaCore = Lua.core();

// Bare state with no stdlib loaded
const luaEmpty = Lua.empty();
luaEmpty.loadCore(); // Dynamically load core stdlib
```

## Examples

Run example scripts using `@oxc-node/core`:

```bash
node --import @oxc-node/core/register examples/primitives.ts
node --import @oxc-node/core/register examples/object.ts
node --import @oxc-node/core/register examples/globals.ts
node --import @oxc-node/core/register examples/function.ts
node --import @oxc-node/core/register examples/async.ts
node --import @oxc-node/core/register examples/memory.ts
node --import @oxc-node/core/register examples/stdlib.ts
```

## Development

- **Install dependencies**: `npm install`
- **Build native add-on**: `npm run build`
- **Run unit tests**: `npm run test`
- **Code check & formatting**: `npm run check`
