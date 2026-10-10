# Embedded Lua in TypeScript/JavaScript via NAPI

This project exports Lua's execution environment and API to TypeScript and JavaScript using NAPI (NAPI-RS) and the `ottavino` Rust crate.

## Usage

You can import the `Lua` class directly from TypeScript or JavaScript to instantiate a Lua environment and evaluate Lua code:

```typescript
import { Lua } from "@lib/module";

const lua = new Lua();

// Evaluate Lua expressions and statements
const sum = lua.eval("return 1 + 2");
console.log(sum); // "3"

const message = lua.eval("return 'Hello from Lua!'");
console.log(message); // "Hello from Lua!"
```

## API

### `Lua`

- **`new Lua()`**: Constructs a new Lua instance with the full standard library loaded.
- **`eval(code: string): string`**: Compiles and executes the provided Lua code string within the environment, returning the result formatted as a string.

## Development

- Install dependencies:

```bash
npm install
```

- Build the native addon:

```bash
npm run build
```

- Run unit tests:

```bash
npm test
```
