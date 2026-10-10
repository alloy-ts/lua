# Embedded Lua in TypeScript/JavaScript via NAPI

This package provides native bindings to embed a Lua 5.4 engine in TypeScript / JavaScript applications using [NAPI-RS](https://napi.rs/) and [ottavino](https://crates.io/crates/ottavino).

## Architecture & How It Works

1. **NAPI-RS Bridge**: `napi-rs` generates high-performance C/C++ Node.js native add-ons from Rust. It marshals data directly between V8 / JS values (`Unknown`, `Object`, primitives) and Rust data structures without manual C glue code.
2. **Pure-Rust Lua Engine**: We embed `ottavino`, a pure-Rust implementation of Lua 5.4. It manages Lua execution inside a garbage-collected arena.
3. **Value Conversion**: JS primitives (`boolean`, `number`, `string`, `null`/`undefined`) and nested objects/arrays automatically convert to corresponding Lua types (`boolean`, `number`, `string`, `nil`, and `table`) and vice-versa.

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

### Passing Objects & Tables

```ts
const lua = new Lua();

// JS Objects convert to Lua Tables
lua.setGlobal("user", { name: "Alice", age: 30 });
const name = lua.eval("return user.name"); // "Alice"

// Lua Tables convert back to JS Objects
const table = lua.eval("return { x = 10, y = 20 }"); // { x: 10, y: 20 }
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

Run any of the example scripts with `@oxc-node/core`:

```bash
node --import @oxc-node/core/register examples/primitives.ts
node --import @oxc-node/core/register examples/object.ts
node --import @oxc-node/core/register examples/globals.ts
node --import @oxc-node/core/register examples/function.ts
node --import @oxc-node/core/register examples/async.ts
```

## Development

- **Install dependencies**:

```bash
npm install
```

- **Build the native add-on and package**:

```bash
npm run build
```

- **Run unit tests**:

```bash
npm run test
```

- **Code check & formatting**:

```bash
npm run check
```
