import { Lua } from "../src/main.ts";

/**
 * Example: Standard Library Sandboxing
 *
 * Demonstrates:
 * - Instantiating Lua VMs with various library levels:
 *   - `Lua.empty()`: Completely sandboxed, empty VM without standard libraries
 *   - `Lua.core()`: Core libraries loaded (math, string, table, coroutine, base), no I/O
 *   - `Lua.full()` or `new Lua()`: Full standard libraries loaded including I/O
 * - Incremental loading:
 *   - `lua.loadCore()`: Load core libraries on demand
 *   - `lua.loadIo()`: Load I/O library on demand
 */

function runStdlibExample() {
  console.log("=== 1. Sandboxed Empty State (`Lua.empty()`) ===");
  const emptyLua = Lua.empty();

  // Basic arithmetic evaluation works without stdlib
  console.log("Arithmetic in empty VM (1 + 2):", emptyLua.eval("return 1 + 2"));

  // Check availability of standard libraries in empty state
  console.log("math module in empty VM:", emptyLua.eval("return math ~= nil")); // false
  console.log("string module in empty VM:", emptyLua.eval("return string ~= nil")); // false
  console.log("io module in empty VM:", emptyLua.eval("return io ~= nil")); // false

  console.log("\n=== 2. Core Library State (`Lua.core()`) ===");
  const coreLua = Lua.core();

  // Core math and string functions are available
  const mathResult = coreLua.eval("return math.sqrt(16) + math.max(10, 20)");
  const stringResult = coreLua.eval("return string.upper('hello from lua')");
  console.log("math library evaluation:", mathResult); // 24
  console.log("string library evaluation:", stringResult); // "HELLO FROM LUA"

  // I/O library is NOT loaded in core mode for security
  console.log("io library available in core mode?:", coreLua.eval("return io ~= nil")); // false

  console.log("\n=== 3. Incremental Library Loading (`loadCore()`, `loadIo()`) ===");
  const sandboxLua = Lua.empty();
  console.log("Before loadCore -> math:", sandboxLua.eval("return math ~= nil")); // false

  console.log("Loading core libraries via sandboxLua.loadCore()...");
  sandboxLua.loadCore();
  console.log("After loadCore -> math:", sandboxLua.eval("return math ~= nil")); // true
  console.log("After loadCore -> io:", sandboxLua.eval("return io ~= nil")); // false

  console.log("Loading I/O library via sandboxLua.loadIo()...");
  sandboxLua.loadIo();
  console.log("After loadIo -> io:", sandboxLua.eval("return io ~= nil")); // true

  console.log("\n=== 4. Full Standard Library State (`Lua.full()`) ===");
  const fullLua = Lua.full();
  console.log("Full VM -> math available:", fullLua.eval("return math ~= nil")); // true
  console.log("Full VM -> table available:", fullLua.eval("return table ~= nil")); // true
  console.log("Full VM -> coroutine available:", fullLua.eval("return coroutine ~= nil")); // true
}

runStdlibExample();
