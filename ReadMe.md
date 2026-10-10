# Embed Lua in TypeScript/JavaScript via NAPI

This module provides TypeScript/JavaScript bindings for embedding and executing Lua code directly in Node.js applications, powered by NAPI (`napi-rs`) and `ottavino`.

## Features

- **Full Lua Environment**: Run Lua scripts with standard library capabilities.
- **High Performance**: Native Rust binding using NAPI-RS for minimal overhead.
- **Seamless JS Interop**: Evaluate Lua expressions and receive converted JavaScript primitive types (`number`, `string`, `boolean`, `undefined`/`nil`).

## Installation / Setup

Ensure local dependencies are installed and the native binary is built:

```bash
npm install
npm run build
```

## Usage Example

### Simple Evaluation with `evalLua`

```typescript
import { evalLua } from "./src/main.ts";

const sum = evalLua("return 10 + 20");
console.log(sum); // Output: 30

const message = evalLua('return "Hello from " .. "Lua!"');
console.log(message); // Output: Hello from Lua!
```

### Using the `Lua` Class

```typescript
import { Lua } from "./src/main.ts";

const lua = Lua.full();

// Evaluate expressions
const result = lua.eval("return math.sqrt(16) * 2");
console.log(result); // Output: 8

// Evaluate scripts
lua.eval('x = 42');
const x = lua.eval('return x');
console.log(x); // Output: 42
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
