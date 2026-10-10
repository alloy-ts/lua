# Lua

> Embed a Lua execution environment into JavaScript applications
> using Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and
[Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM
implementation derived from Piccolo and `gc-arena`) to safely expose Lua's API to Node.js and JavaScript
environments without external native C dependencies.

## Documentation

- [API Reference](docs/api.md) — Detailed class constructor, method, and value conversion documentation.
- [Lua 5.4 Language & Stdlib Guide](docs/lang-guide.md) — Lua language overview, standard library modules, and Ottavino VM stackless architecture (`fuel`, cancellation, `coroutine.yieldto`).

## Features

- **Full Lua Environment**: Create sandboxed Lua states with empty, core, or
  full standard libraries.
- **Pure Rust Stackless VM**: Powered by Ottavino/Piccolo trampoline execution loop with `gc-arena` memory safety and zero external C dependencies.
- **Eval & Step Execution**: Run arbitrary Lua scripts synchronously or step execution via `createExecutor` / `stepExecutor` with fuel budgets.
- **Host Callback Binding**: Register TS/JS functions as callable host functions in Lua using `registerCallback`.
- **Global Variable Binding**: Get and set global variables in the Lua VM
  directly from JS/TS.
- **Symmetric Coroutines**: Supports direct tail-yielding via `coroutine.yieldto(co, ...)` without stack leaks.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`) and
  manually trigger garbage collection (`gcCollect()`).

## Usage Example

```typescript
import { Lua } from "@alloy-ts/lua";

// Create a Lua instance with the full standard library loaded
const lua = Lua.full();

// Evaluate Lua expressions and scripts
const result = lua.eval("return 1 + 2 * 3");
console.log(result); // 7

// Register a JS function as a callable callback in Lua
lua.registerCallback("multiplyJS", (a: number, b: number) => a * b);
console.log(lua.eval("return multiplyJS(6, 7)")); // 42

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

// Step-by-step executor with fuel budget
const executor = lua.createExecutor("return 100 + 200");
const stepRes = lua.stepExecutor(executor, 100);
console.log(stepRes); // { done: true, value: 300 }

// Check memory usage and trigger garbage collection
console.log(`Memory used: ${lua.totalMemory()} bytes`);
lua.gcCollect();
```

## Runnable Examples

The `examples/` directory contains runnable TypeScript scripts demonstrating various features:

- [`examples/primitives.ts`](examples/primitives.ts) — TS primitives, variables, and read-only constants in Lua.
- [`examples/object.ts`](examples/object.ts) — TS objects and arrays mapped to Lua tables.
- [`examples/variables.ts`](examples/variables.ts) — Merged global variable and object handling guide.
- [`examples/function.ts`](examples/function.ts) — Defining, calling, registering JS callbacks, and inspecting functions.
- [`examples/coroutine.ts`](examples/coroutine.ts) — Cooperative concurrency using Lua coroutines.
- [`examples/memory.ts`](examples/memory.ts) — Memory usage tracking and manual GC controls.
- [`examples/stdlib.ts`](examples/stdlib.ts) — Standard library sandboxing (`empty`, `core`, `full`, `loadCore`, `loadIo`).

Run any example script directly using `@oxc-node/core`:

```bash
node --import @oxc-node/core/register examples/function.ts
```

## API Reference

### Constructors

- `Lua.full()` or `new Lua()`: Instantiates a Lua VM with the full standard
  library loaded (base, coroutine, math, string, table, I/O).
- `Lua.core()`: Instantiates a Lua VM with core standard libraries loaded (no
  I/O).
- `Lua.empty()`: Instantiates an empty Lua VM with no standard libraries.

### Methods

- `lua.eval(code: string): unknown`: Compiles and executes the given Lua code
  string, returning the result as a JavaScript value.
- `lua.createExecutor(code: string): LuaExecutor`: Creates a step-by-step executor for Lua code.
- `lua.stepExecutor(executor: LuaExecutor, fuelAmount: number): { done: boolean; value?: unknown }`: Steps an executor forward by fuel amount.
- `lua.registerCallback(name: string, callback: Function): void`: Binds a JS function as a global callable callback in Lua.
- `lua.setGlobal(name: string, value: unknown): void`: Sets a global variable in
  the Lua VM environment.
- `lua.getGlobal(name: string): unknown`: Retrieves a global variable from the
  Lua VM environment.
- `lua.loadCore(): void`: Loads core standard libraries into an existing Lua
  state.
- `lua.loadIo(): void`: Loads I/O standard libraries into an existing Lua state.
- `lua.totalMemory(): number`: Returns total memory used by the Lua VM in bytes.
- `lua.gcCollect(): void`: Triggers a full garbage collection cycle in the Lua
  VM.
- `lua.gcMetrics(): GcMetrics`: Returns garbage collector metrics.

### Value Conversion

Results of `eval` and values read via `getGlobal` are converted from Lua values
to JavaScript as follows:

| Lua value            | JavaScript value                        |
| -------------------- | --------------------------------------- |
| `nil`                | `undefined`                             |
| `boolean`            | `boolean`                               |
| `integer`            | `number`                                |
| `float`              | `number`                                |
| `string`             | `string`                                |
| `table` (sequential) | `Array`                                 |
| `table` (keyed)      | `Object`                                |
| `function`           | `"[lua function]"` (placeholder string) |
| `thread`             | `"[lua thread]"` (placeholder string)   |
| `userdata`           | `"[lua userdata]"` (placeholder string) |

Conversely, `setGlobal` converts JavaScript `undefined`/`null` → `nil`,
`boolean` → `boolean`, integer-valued `number` → Lua `integer` (otherwise
`number`), `string` → `string`, `Array` → sequential `table`, and plain `Object`
→ keyed `table`. A Lua `table` is treated as an `Array` whenever its sequential
length is greater than zero, so a table that mixes a sequence with hash keys may
lose the hash entries.

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
