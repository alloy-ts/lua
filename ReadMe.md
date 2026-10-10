# Embedded Lua for TypeScript/JavaScript via NAPI

Embed and execute Lua code directly in Node.js / TypeScript using native NAPI-RS bindings.

## Features

- **Embedded Lua Environment**: Run Lua scripts directly within TypeScript/JavaScript.
- **Multiple Environments**:
  - `Lua.empty()`: Bare-bones environment without stdlib.
  - `Lua.core()`: Non-I/O standard library loaded (math, string, table, base, coroutine).
  - `Lua.full()`: Full standard library including I/O loaded.
- **Bounded Step Execution**: Drive execution step-by-step with `lua.executor(code)` and `exec.step(lua, fuel)` for pacing and cancellation.
- **NAPI Native Speed**: Fast, native execution powered by Rust and `ottavino`.

## Usage Example

```typescript
import { Lua } from "@lib/module";

// Create a Lua instance with the core stdlib loaded
const lua = Lua.core();

// Set global variables
lua.setGlobal("appName", "My App");

// Evaluate Lua expressions
const result = lua.eval("return string.upper('hello from lua')");
console.log(result); // "HELLO FROM LUA"

// Bounded step execution with fuel pacing
const exec = lua.executor("local sum = 0; for i = 1, 100 do sum = sum + i end; return sum");
while (!exec.step(lua, 50)) {
  // Can yield, pause, or cancel loop between steps
}
console.log("Executor result:", exec.takeResult(lua)); // "5050"
```

## Development

- Configure local hooks:

```bash
npm run prepare
```

- Install dependencies:

```bash
vp install
```

- Run unit tests:

```bash
vp test
```

- Run locally:

```bash
npm run dev
```

- Build native bindings:

```bash
npm run build:napi
```

- Build library:

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
