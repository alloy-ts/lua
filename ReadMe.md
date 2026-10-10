# Lua in TypeScript / JavaScript via NAPI

> Embed a Lua execution environment into TypeScript and JavaScript applications by exporting Lua's API via NAPI (Node-API).

This library uses [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM implementation) to safely expose Lua's API to Node.js and JavaScript environments without external native C dependencies.

## How it Works

To support embedded Lua in TypeScript/JavaScript via NAPI:

1. **Native Binding Layer (NAPI-RS)**: Rust functions and classes are decorated with `#[napi]` attributes to generate native Node.js bindings (`.node` binary).
2. **Lua Engine**: A Rust-implemented Lua 5.4 VM (`ottavino`) executes Lua bytecode sandboxed inside the process memory space.
3. **Type Conversion**: JS primitives (`number`, `string`, `boolean`, `null/undefined`) and structures (`object`, `array`) are mapped bidirectionally to Lua types (`integer`, `number`, `string`, `table`, `nil`).
4. **Exported API**: The `Lua` class is exported via NAPI to TypeScript/JavaScript, providing methods to evaluate code, manage global variables, load standard libraries, and control garbage collection.

## Documentation

- **[Language & Standard Library Guide](docs/lang-guide.md)**: Lua 5.4 basics, standard library overview (`math`, `string`, `table`, `coroutine`, `io`), WASI p3 sandboxing, and what the pure-Rust Ottavino engine provides.
- **[API Reference](docs/api.md)**: Full API documentation for the exported `Lua` class, constructors, methods, GC metrics interface, and JS-to-Lua type mapping rules.

## Examples & Usage

### 1. Defining Lua Variables, Objects & Constants from TS/JS

You can define Lua global variables, primitives, objects, and read-only constants from TypeScript using `lua.setGlobal(name, value)` and `lua.eval()`:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();

// Set Primitives (number, string, boolean, null)
lua.setGlobal("MAX_CONNECTIONS", 100);
lua.setGlobal("APP_NAME", "Lua Engine");

// Set Objects & Arrays (Converted to Lua tables)
lua.setGlobal("user", {
  id: 101,
  username: "alice",
  roles: ["admin", "developer"],
});

// Read-Only Constants (Protected via Lua metatables)
lua.eval(`
  CONSTANTS = setmetatable({}, {
    __index = { MAX_RETRIES = 5 },
    __newindex = function(_, key, _)
      error("Attempt to modify read-only constant: " .. tostring(key), 2)
    end
  })
`);
```

See [examples/globals.ts](examples/globals.ts) for a runnable variables and constants example.

### 2. Defining & Calling Lua Functions from TS/JS

Lua functions, closures, and recursive functions can be defined and executed using `lua.eval()`:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();

// Define a function in Lua
lua.eval(`
  function calculateTotal(items, taxRate)
    local total = 0
    for _, item in ipairs(items) do
      total = total + item.price * item.quantity
    end
    return total * (1 + taxRate)
  end
`);

// Pass parameters from TS and invoke the function
lua.setGlobal("items", [{ price: 100, quantity: 2 }]);
lua.setGlobal("taxRate", 0.1);
const total = lua.eval("return calculateTotal(items, taxRate)");
console.log("Calculated total:", total); // 220
```

See [examples/function.ts](examples/function.ts) for a runnable function and closure example.

### 3. Asynchronous Execution & Coroutines with JS Promises

Lua natively supports cooperative multitasking via **Coroutines**. You can yield values from Lua coroutines back to JavaScript Promises and resume Lua execution once the async data resolves:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();

// Define a Lua coroutine that yields async requests
lua.eval(`
  co = coroutine.create(function()
    local user = coroutine.yield({ action = "FETCH_USER", id = 42 })
    return "Completed for " .. user.name
  end)
`);

// Resume coroutine, resolve async Promise, and resume with result
const [_, request] = lua.eval("return { coroutine.resume(co) }");
const userData = await fetchUserAsync(request.id);
lua.setGlobal("resumedVal", userData);
const [__, result] = lua.eval("return { coroutine.resume(co, resumedVal) }");
```

See [examples/async.ts](examples/async.ts) for a runnable async coroutine example.

### 4. Memory Monitoring & Manual Garbage Collection

Monitor memory usage in bytes and manually trigger garbage collection cycles:

```typescript
import { Lua } from "@lib/module";

const lua = Lua.full();
console.log(`Memory used: ${lua.totalMemory()} bytes`);

// Perform manual garbage collection and fetch GC metrics
lua.gcCollect();
const metrics = lua.gcMetrics();
console.log("Total Allocation:", metrics.totalAllocation);
```

See [examples/memory.ts](examples/memory.ts) for a runnable memory management example.

### 5. Standard Library Sandboxing

Selectively load standard libraries or start with a completely empty VM for secure sandboxing:

```typescript
import { Lua } from "@lib/module";

// Create an empty VM without standard libraries
const emptyLua = Lua.empty();

// Progressively load core libraries (math, string, table, coroutine) and I/O
emptyLua.loadCore();
emptyLua.loadIo();
```

See [examples/stdlib.ts](examples/stdlib.ts) for a runnable sandboxing example. Run all examples with:

```bash
node --import @oxc-node/core examples/globals.ts
node --import @oxc-node/core examples/function.ts
node --import @oxc-node/core examples/async.ts
node --import @oxc-node/core examples/memory.ts
node --import @oxc-node/core examples/stdlib.ts
```

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

- **WASI (Preview 1 / WASI p3)**: The `wasm32-wasip1` / `wasm32-wasip1-threads` targets produce `.wasm` binaries and `.wasi.cjs` loaders that run in Node.js and WASI runtimes.
  - **`Lua.core()`**: Contains zero filesystem/I/O syscall dependencies and runs safely inside restricted WASI Preview 3 sandboxes without requiring filesystem capabilities (`wasi:filesystem`).
  - **`Lua.full()`**: Includes the `io` library and requires host permissions for WASI I/O capabilities (`wasi:cli/stdout`, `wasi:filesystem/preopens`).
- **Browsers & emnapi**: Dev dependencies include `@emnapi/core`, `@emnapi/runtime`, and `emnapi`. When building with Emscripten (`wasm32-unknown-emscripten`) or linking via `emnapi`, Node-API host functions (`env.napi_*`) are mapped directly to browser JS runtimes, enabling embedded Lua execution in WebAssembly inside modern web browsers.

## API Reference

For complete API documentation, including constructor overloads, method signatures, memory GC metrics interfaces, and JS-to-Lua type mapping rules, see [docs/api.md](docs/api.md).

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
