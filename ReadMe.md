# Embed Lua in TypeScript/JavaScript via NAPI

This module provides TypeScript/JavaScript bindings for embedding and executing Lua code directly in Node.js applications, powered by NAPI (`napi-rs`) and `ottavino`.

## Features

- **Full Lua Environment**: Run Lua scripts with standard library capabilities.
- **High Performance**: Native Rust binding using NAPI-RS for minimal overhead.
- **Seamless JS Interop**: Evaluate Lua expressions, set global variables (`setGlobal`), and retrieve global variables (`getGlobal`).
- **Memory & GC Control**: Monitor VM memory usage (`totalMemory`) and trigger manual GC (`gcCollect`).
- **API Documentation**: Complete API mapping and method reference in [docs/api.md](./docs/api.md).
- **Language Guide**: Lua 5.4 basics, stdlib, and `ottavino` stackless VM architecture in [docs/lang-guide.md](./docs/lang-guide.md).

## Installation / Setup

Ensure local dependencies are installed and the native binary is built:

```bash
npm install
npm run build
```

## Usage Examples

### Simple Evaluation with `evalLua`

```typescript
import { evalLua } from "./src/main.ts";

const sum = evalLua("return 10 + 20");
console.log(sum); // Output: 30

const message = evalLua('return "Hello from " .. "Lua!"');
console.log(message); // Output: Hello from Lua!
```

### Using the `Lua` Class with `setGlobal` & `getGlobal`

```typescript
import { Lua } from "./src/main.ts";

const lua = Lua.full();

// Set primitive globals
lua.setGlobal("MAX_ITEMS", 100);

// Set TS object as a Lua table
lua.setGlobal("config", {
  port: 8080,
  host: "localhost",
});

// Evaluate expressions using set globals
const result = lua.eval("return config.host .. ':' .. tostring(config.port)");
console.log(result); // Output: localhost:8080

// Retrieve global variables directly from JS
console.log("MAX_ITEMS:", lua.getGlobal("MAX_ITEMS")); // Output: 100
```

## Examples Directory

Check out executable TypeScript examples in the `examples/` directory:

- `examples/primitives.ts` — Setting primitive variables and constants
- `examples/object.ts` — Passing structured JS objects to Lua tables
- `examples/globals.ts` — Comprehensive global variable management
- `examples/function.ts` — Defining and calling Lua functions
- `examples/coroutines.ts` — Generator patterns with Lua coroutines
- `examples/memory.ts` — Memory tracking and manual GC
- `examples/stdlib.ts` — Sandboxing and stdlib loading

Run any example with `npx tsx`:

```bash
npx tsx examples/globals.ts
```

## Development & Testing

- Run tests:

```bash
npm test
```

- Build native binaries:

```bash
npm run build:napi
```
