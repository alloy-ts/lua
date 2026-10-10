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

## Documentation & Examples

- **[API Reference Documentation](docs/api.md)**: Detailed specification of all exported classes, methods, and interfaces.
- **[Examples](examples/)**:
  - [`examples/variables.ts`](examples/variables.ts): Defining variables, primitives, read-only constants, and objects/tables.
  - [`examples/function.ts`](examples/function.ts): Defining functions, higher-order functions, and stateful closures.
  - [`examples/memory.ts`](examples/memory.ts): Memory monitoring and explicit garbage collection (`totalMemory()`, `gcCollect()`, `gcMetrics()`).
  - [`examples/stdlib.ts`](examples/stdlib.ts): Sandboxing and standard library controls (`Lua.empty()`, `Lua.core()`, `Lua.full()`, `loadCore()`, `loadIo()`).

## API Summary

### `Lua`

- **`new Lua()` / `Lua.full()`**: Constructs a Lua instance with the full standard library (including I/O).
- **`Lua.empty()`**: Constructs a completely sandboxed Lua instance without stdlib modules.
- **`Lua.core()`**: Constructs a sandboxed Lua instance with non-I/O stdlib modules loaded.
- **`loadCore()`**: Loads non-I/O stdlib modules (`base`, `coroutine`, `math`, `string`, `table`).
- **`loadIo()`**: Loads I/O stdlib modules.
- **`eval(code: string): string`**: Compiles and executes Lua code string, returning the formatted result string.
- **`totalMemory(): number`**: Returns currently allocated memory in bytes.
- **`gcCollect(): void`**: Triggers a complete garbage collection cycle.
- **`gcMetrics(): GcMetrics`**: Returns snapshot of GC metrics.

## Development

- Install dependencies:

```bash
npm install
```

- Build native addon:

```bash
npm run build
```

- Run unit tests:

```bash
npm test
```

- Run example scripts:

```bash
node --import @oxc-node/core examples/variables.ts
node --import @oxc-node/core examples/function.ts
node --import @oxc-node/core examples/memory.ts
node --import @oxc-node/core examples/stdlib.ts
```
