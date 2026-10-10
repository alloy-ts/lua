# Embedded Lua in TypeScript/JavaScript via NAPI

This package provides native bindings to embed a Lua 5.4 engine in TypeScript / JavaScript applications using [NAPI-RS](https://napi.rs/) and [ottavino](https://crates.io/crates/ottavino).

## Architecture & How It Works

1. **NAPI-RS Bridge**: `napi-rs` generates high-performance Node.js native add-ons from Rust. It marshals data directly between V8 / JS values (`Unknown`, `Object`, primitives) and Rust data structures without manual C glue code.
2. **Pure-Rust Lua Engine**: We embed `ottavino`, a pure-Rust implementation of Lua 5.4. It manages Lua execution inside a garbage-collected arena.
3. **Value Conversion**: JS primitives (`boolean`, `number`, `string`, `null`/`undefined`) and nested objects/arrays automatically convert to corresponding Lua types (`boolean`, `number`, `string`, `nil`, and `table`) and vice-versa.
4. **Callable Host Functions**: JavaScript functions can be bound to the Lua environment using `registerCallback(name, jsFn)`, enabling Lua code to invoke host TypeScript/JavaScript functions directly.
5. **Exception Propagation**: Lua syntax/runtime errors and host JS callback exceptions propagate seamlessly across the JS/Lua boundary and can be caught via standard JS `try/catch` or Lua `pcall`.
6. **Stackless Interpreter & Fuel Pacing**: Long-running Lua execution can be stepped using fuel limits (`Executor.step(fuel)`), enabling pre-emptive concurrency, cancellation, and execution pacing.

## Usage

### Basic Evaluation

```ts
import { Lua } from "@lib/module";

const lua = new Lua();

// Evaluate Lua code expressions
const sum = lua.eval("return 10 + 20"); // 30
const greeting = lua.eval("return 'Hello ' .. 'World!'"); // "Hello World!"
```

### Global Variables & Values

```ts
const lua = new Lua();

// Set global variables from JS to Lua
lua.setGlobal("multiplier", 3);

// Access global variables inside Lua code
const result = lua.eval("return 14 * multiplier"); // 42

// Get global variables back in JS
const val = lua.getGlobal("multiplier"); // 3
```

### Registering Host JS Functions (Callable from Lua)

Use `registerCallback(name, fn)` to bind a JavaScript/TypeScript function as a global callable function inside Lua:

```ts
const lua = new Lua();

// Register host JS functions
lua.registerCallback("hostAdd", (a: number, b: number) => a + b);
lua.registerCallback("hostGreet", (name: string) => `Hello, ${name}!`);

// Call registered host functions directly inside Lua scripts
const total = lua.eval("return hostAdd(15, 25)"); // 40
const message = lua.eval("return hostGreet('World')"); // "Hello, World!"
```

### Error Handling & Exception Propagation

```ts
const lua = new Lua();

// 1. Catching Lua syntax/runtime errors in JS
try {
  lua.eval("error('Explicit runtime error from Lua!')");
} catch (err: any) {
  console.log("Caught Lua error in JS:", err.message);
}

// 2. Exception thrown inside registered JS callback
lua.registerCallback("failingFunc", () => {
  throw new Error("Failure in host JS function!");
});

try {
  lua.eval("return failingFunc()");
} catch (err: any) {
  console.log("Caught propagated JS error:", err.message);
}
```

### Passing Objects & Tables

```ts
const lua = new Lua();

// JS Objects convert to Lua Tables
lua.setGlobal("user", { name: "Alice", age: 30 });
const name = lua.eval("return user.name"); // "Alice"

// Lua Tables convert back to JS Objects
const table = lua.eval("return { x = 10, y = 20 }"); // { x: 10, y: 20 }
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
node --import @oxc-node/core/register examples/error.ts
```

## Documentation

- [API Reference](docs/api.md)
- [Lua 5.4 & Ottavino Language Guide](docs/lang-guide.md)

## Development

- **Install dependencies**: `npm install`
- **Build native add-on**: `npm run build`
- **Run unit tests**: `npm run test`
- **Code check & formatting**: `npm run check`
