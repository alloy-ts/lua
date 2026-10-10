# Lua in TypeScript / JavaScript via NAPI

> Embed a Lua execution environment into TypeScript and JavaScript applications by exporting Lua's API via NAPI (Node-API).

This library uses [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM implementation) to safely expose Lua's API to Node.js and JavaScript environments without external native C dependencies.

## How it Works

To support embedded Lua in TypeScript/JavaScript via NAPI:

1. **Native Binding Layer (NAPI-RS)**: Rust functions and classes are decorated with `#[napi]` attributes to generate native Node.js bindings (`.node` binary).
2. **Lua Engine**: A Rust-implemented Lua 5.4 VM (`ottavino`) executes Lua bytecode sandboxed inside the process memory space.
3. **Type Conversion**: JS primitives (`number`, `string`, `boolean`, `null/undefined`) and structures (`object`, `array`) are mapped bidirectionally to Lua types (`integer`, `number`, `string`, `table`, `nil`).
4. **Exported API**: The `Lua` class is exported via NAPI to TypeScript/JavaScript, providing methods to evaluate code, manage global variables, load standard libraries, and control garbage collection.

## Examples & Usage

### 1. Defining Lua Primitives & Constants from TS/JS

You can define Lua global variables and constants from TypeScript using `lua.setGlobal(name, value)`:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();

// Set primitives (number, string, boolean, null)
lua.setGlobal("MAX_CONNECTIONS", 100);
lua.setGlobal("APP_NAME", "Lua Engine");
lua.setGlobal("DEBUG_MODE", true);

// Define read-only constants in Lua via metatables
lua.eval(`
  CONSTANTS = setmetatable({}, {
    __index = { MAX_RETRIES = 5, ENVIRONMENT = "production" },
    __newindex = function(_, key, _)
      error("Attempt to modify read-only constant: " .. tostring(key), 2)
    end
  })
`);
```

See [examples/primitives.ts](examples/primitives.ts) for a runnable primitives example.

### 2. Defining Lua Objects & Tables from TS/JS

JavaScript objects and arrays are automatically converted to Lua tables when passed via NAPI:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();

// Define a JS object and export it to Lua as a global table
lua.setGlobal("user", {
  id: 101,
  username: "alice",
  profile: { firstName: "Alice", age: 28 },
  roles: ["admin", "developer"],
});

// Access and modify object properties inside Lua scripts
lua.eval(`
  user.profile.age = 29
  table.insert(user.roles, "lead")
`);

// Fetch the modified object back into JS/TS
const updatedUser = lua.getGlobal("user");
console.log(updatedUser.profile.age); // 29
```

See [examples/object.ts](examples/object.ts) for a runnable object/table example.

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or full standard libraries.
- **Eval Lua Code**: Run arbitrary Lua scripts and return JavaScript primitives, objects, and arrays.
- **Global Variable Binding**: Get and set global variables in the Lua VM directly from JS/TS.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`) and manually trigger garbage collection (`gcCollect()`).

## Usage Example

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

## Cross-Building & WebAssembly (WASM / WASI / Browser)

### Cross-Building All Targets

NAPI targets are defined in `package.json` under `napi.targets`. To build for all configured native and WebAssembly targets:

```bash
# Build default target
npm run build:napi

# Cross-build specific WebAssembly / WASI target
npm run build:napi -- --target wasm32-wasip1-threads
```

### Pure Rust Advantage

Because `ottavino` is a pure Rust Lua VM, cross-compiling to WebAssembly does not require external C toolchains or system C libraries.

### Browser & WASI p3 Support with emnapi / emscripten

- **WASI (Preview 1 / WASI p3)**: The `wasm32-wasip1` / `wasm32-wasip1-threads` targets produce `.wasm` binaries and `.wasi.cjs` loaders that run in Node.js and WASI runtimes. For WASI Preview 2/3 component runtimes, standard WASI p1-to-p2/p3 adapters wrap the generated WebAssembly binary without requiring WIT definitions.
- **Browsers & emnapi**: Dev dependencies include `@emnapi/core`, `@emnapi/runtime`, and `emnapi`. When building with Emscripten (`wasm32-unknown-emscripten`) or linking via `emnapi`, Node-API host functions (`env.napi_*`) are mapped directly to browser JS runtimes, enabling embedded Lua execution in WebAssembly inside modern web browsers.

## API Reference

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with the full standard library loaded (base, coroutine, math, string, table, I/O).
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code string, returning the result as a JavaScript value.
- `lua.setGlobal(name: string, value: unknown): void`: Sets a global variable in the Lua VM environment.
- `lua.getGlobal(name: string): unknown`: Retrieves a global variable from the Lua VM environment.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics.

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
