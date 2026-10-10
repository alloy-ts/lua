import { Lua } from "../index.js";

/**
 * Example demonstrating standard library sandboxing and dynamic library loading
 * in Lua execution environments: `Lua.empty()`, `Lua.core()`, `Lua.full()`,
 * `loadCore()`, and `loadIo()`.
 */
export function runStdlibExample() {
  console.log("=== Part 1: Empty Sandboxed Environment (Lua.empty()) ===");

  const emptyLua = Lua.empty();

  // Custom mathematical calculation in empty environment
  emptyLua.eval("x = 10; y = 20; result = x + y");
  console.log("Custom math in empty environment:", emptyLua.eval("return result")); // 30

  // Standard library modules are absent in empty environment
  console.log("math library in empty VM:", emptyLua.eval("return math")); // undefined
  console.log("print function in empty VM:", emptyLua.eval("return print")); // undefined

  console.log("\n=== Part 2: Core Standard Library Environment (Lua.core()) ===");

  const coreLua = Lua.core();

  // Core math, string, table modules are pre-loaded
  console.log("math.sin(0) in core VM:", coreLua.eval("return math.sin(0)")); // 0
  console.log("string.upper('hello') in core VM:", coreLua.eval("return string.upper('hello')")); // "HELLO"
  console.log("io library in core VM:", coreLua.eval("return io")); // undefined

  console.log("\n=== Part 3: Full Standard Library Environment (Lua.full()) ===");

  const fullLua = Lua.full();

  console.log("math.max(10, 20) in full VM:", fullLua.eval("return math.max(10, 20)")); // 20
  console.log("print function in full VM:", fullLua.eval("return print")); // "[lua function]"

  console.log("\n=== Part 4: Dynamically Loading Standard Libraries ===");

  const dynamicLua = Lua.empty();
  console.log("Before loadCore - math:", dynamicLua.eval("return math")); // undefined

  // Load core standard libraries (math, string, table, coroutine)
  dynamicLua.loadCore();
  console.log("After loadCore - math.abs(-42):", dynamicLua.eval("return math.abs(-42)")); // 42
  console.log("Before loadIo - print:", dynamicLua.eval("return print")); // undefined

  // Load I/O standard libraries
  dynamicLua.loadIo();
  console.log("After loadIo - print:", dynamicLua.eval("return print")); // "[lua function]"
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runStdlibExample();
}
