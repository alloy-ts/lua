# Embedded Lua for TypeScript/JavaScript (via NAPI)

Embed a Lua 5.4 execution environment into TypeScript and JavaScript applications by exporting Lua's C/Rust VM API via NAPI.

This library uses [NAPI-RS](https://napi.rs/) and [Ottavino](https://github.com/kyren/ottavino) (a pure Rust Lua 5.4 VM implementation) to safely expose Lua's API to Node.js and JavaScript environments without external native C dependencies.

## Key Features

- **Full Lua 5.4 Environment**: Create sandboxed Lua states with empty, core, or full standard libraries.
- **Stackless VM Architecture**: Reifies execution state into heap structures driven by polling (`Executor::step`), enabling bounded execution and pre-emptive time slicing.
- **Eval & Step Execution**: Run scripts synchronously with `eval()` or step through execution using `lua.executor()` with `Fuel` budgets.
- **JS Callback Registration**: Expose host JS functions into Lua using `lua.registerCallback()`.
- **Global Variable Binding**: Get and set global variables in the Lua VM directly from TS/JS.
- **GC & Memory Controls**: Monitor memory consumption (`totalMemory()`), inspect allocation metrics (`gcMetrics()`), and manually trigger garbage collection (`gcCollect()`).

## Quick Usage Example

```typescript
import { Lua } from "@lib/module";

// Create a Lua instance with the full standard library loaded
const lua = Lua.full();

// Evaluate Lua expressions and scripts
const result = lua.eval("return 1 + 2 * 3");
console.log(result); // 7

// Register a JS callback in Lua
lua.registerCallback("hostLog", () => {
  console.log("Logged from Lua!");
});
lua.eval("hostLog()");

// Step-driven execution with fuel budget
const executor = lua.executor("local sum = 0; for i = 1, 100 do sum = sum + i end; return sum");
while (!executor.step(lua, 50)) {
  // polling...
}
console.log("Executor result:", executor.takeResult(lua)); // 5050
```

## API Summary

- `Lua.full()` / `new Lua()`: Creates a VM with full stdlib (including I/O).
- `Lua.core()`: Creates a VM with core stdlib (no I/O).
- `Lua.empty()`: Creates an empty VM for strict sandboxing.
- `lua.eval(code: string): unknown`: Evaluates Lua code and converts return value to TS/JS.
- `lua.executor(code: string): Executor`: Returns a step-driven `Executor` handle.
- `lua.registerCallback(name, callback)`: Registers a JS host function in Lua.
- `lua.setGlobal(name, value)` / `lua.getGlobal(name)`: Bidirectional variable getter/setter.
- `lua.totalMemory()` / `lua.gcCollect()` / `lua.gcMetrics()`: Memory tracking & GC controls.

For detailed documentation, see:
- [API Reference (`docs/api.md`)](./docs/api.md)
- [Lua 5.4 & Ottavino Language Guide (`docs/lang-guide.md`)](./docs/lang-guide.md)

## Examples

Check the [`examples/`](./examples/) folder for runnable TypeScript examples:
- [`examples/variables.ts`](./examples/variables.ts): Defining primitive variables, constants, objects, and metatables.
- [`examples/primitives.ts`](./examples/primitives.ts): Working with numbers, strings, booleans, and nulls.
- [`examples/object.ts`](./examples/object.ts): Table/object manipulation and OOP patterns.
- [`examples/function.ts`](./examples/function.ts): Defining and invoking Lua functions.
- [`examples/executor.ts`](./examples/executor.ts): Step-driven execution and fuel polling with `Executor`.
- [`examples/callback.ts`](./examples/callback.ts): Registering JS host functions as Lua callbacks.
- [`examples/memory.ts`](./examples/memory.ts): Memory tracking and garbage collection controls.
- [`examples/stdlib.ts`](./examples/stdlib.ts): Sandboxing and standard library loading.

Run any example using `@oxc-node/core`:
```bash
node --import @oxc-node/core/register examples/executor.ts
```

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
