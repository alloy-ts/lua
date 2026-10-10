import { Lua } from "../src/main.ts";

/**
 * Example: Standard Library Sandboxing and Incremental Loading
 */
function main() {
  console.log("=== 1. Lua.empty() - Completely Empty Sandbox ===");
  const emptyLua = Lua.empty();

  // Basic VM operations like arithmetic work in an empty state:
  console.log("1 + 2 in Lua.empty():", emptyLua.eval("return 1 + 2"));

  // Standard library global functions like `type` or `string` do not exist:
  try {
    emptyLua.eval("return type(123)");
  } catch (err) {
    console.log("Caught expected error in Lua.empty() when calling type():", (err as Error).message);
  }

  console.log("\n=== 2. Lua.core() - Core Standard Library (No I/O) ===");
  const coreLua = Lua.core();

  // Base, string, math, table, coroutine libraries are available:
  console.log("type(123) in Lua.core():", coreLua.eval("return type(123)"));
  console.log("string.upper('hello') in Lua.core():", coreLua.eval("return string.upper('hello')"));
  console.log("math.sqrt(16) in Lua.core():", coreLua.eval("return math.sqrt(16)"));

  console.log("\n=== 3. Incremental Library Loading: loadCore() and loadIo() ===");
  const customLua = Lua.empty();

  console.log("Loading core libraries dynamically via loadCore()...");
  customLua.loadCore();
  console.log("string.reverse('alloy') after loadCore():", customLua.eval("return string.reverse('alloy')"));

  console.log("Loading I/O library dynamically via loadIo()...");
  customLua.loadIo();
  console.log("loadIo() executed successfully.");

  console.log("\n=== 4. Lua.full() - Full Standard Library Instance ===");
  const fullLua = Lua.full();
  console.log("Full instance instantiated successfully.");
  console.log("math.max(10, 20, 5) in Lua.full():", fullLua.eval("return math.max(10, 20, 5)"));
}

main();
