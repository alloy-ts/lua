# Embedded Lua for TypeScript/JavaScript via NAPI

Embed and execute Lua code directly in Node.js / TypeScript using native NAPI-RS bindings.

## Features

- **Embedded Lua Environment**: Run Lua scripts directly within TypeScript/JavaScript.
- **Multiple Environments**:
  - `Lua.empty()`: Bare-bones environment without stdlib.
  - `Lua.core()`: Non-I/O standard library loaded (math, string, table, base, coroutine).
  - `Lua.full()`: Full standard library including I/O loaded.
- **NAPI Native Speed**: Fast, native execution powered by Rust and `ottavino`.

## Usage Example

```typescript
import { Lua } from "@lib/module";

// Create a Lua instance with the core stdlib loaded
const lua = Lua.core();

// Evaluate Lua expressions
const result = lua.eval("return string.upper('hello from lua')");
console.log(result); // "HELLO FROM LUA"

// Math evaluation
const mathResult = lua.eval("return math.sqrt(144)");
console.log(mathResult); // "12"
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

- Run the unit tests:

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

- Build the library:

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
