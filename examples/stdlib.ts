import { Lua } from "../src/main.ts";

/**
 * Example: Sandboxing and Standard Library Controls in Lua VM.
 *
 * Demonstrates:
 * - `Lua.empty()`: Instantiating a bare sandbox VM without standard libraries.
 * - `Lua.core()`: Instantiating a VM with core standard libraries (math, string, table, coroutine).
 * - `Lua.full()`: Instantiating a VM with all standard libraries loaded.
 * - `lua.loadCore()`: Incrementally loading core standard libraries into an empty VM.
 * - `lua.loadIo()`: Incrementally loading I/O standard library into a VM.
 */
function runStdlibExample() {
  console.log("=== Lua Standard Library Sandboxing Example ===\n");

  // 1. Empty Sandbox Environment (Lua.empty())
  console.log("--- 1. Empty Sandbox VM (Lua.empty()) ---");
  const emptyLua = Lua.empty();

  // Basic arithmetic works (VM opcode level)
  console.log("1 + 1 in empty VM:", emptyLua.eval("return 1 + 1")); // 2

  // Standard library globals like 'type' or 'math' do not exist
  try {
    emptyLua.eval("return type('test')");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log("Base function 'type' missing in empty VM as expected:", err.message);
    }
  }

  // 2. Incrementally loading core libraries (loadCore())
  console.log("\n--- 2. Incrementally Loading Core Libraries (loadCore()) ---");
  emptyLua.loadCore();

  console.log("type('hello') after loadCore():", emptyLua.eval("return type('hello')")); // "string"
  console.log("math.max(10, 20) after loadCore():", emptyLua.eval("return math.max(10, 20)")); // 20
  console.log("string.upper('lua') after loadCore():", emptyLua.eval("return string.upper('lua')")); // "LUA"

  // 3. Core VM (Lua.core())
  console.log("\n--- 3. Core VM Instance (Lua.core()) ---");
  const coreLua = Lua.core();

  console.log("math.pi in Core VM:", coreLua.eval("return math.pi"));
  console.log(
    "table.concat(['a', 'b'], '-') in Core VM:",
    coreLua.eval("return table.concat({'a', 'b'}, '-')"),
  );

  // 4. Full VM (Lua.full())
  console.log("\n--- 4. Full VM Instance (Lua.full()) ---");
  const fullLua = Lua.full();

  console.log("Full VM memory footprint:", fullLua.totalMemory(), "bytes");
}

runStdlibExample();
