import { Lua } from "../src/main.ts";

/**
 * Example demonstrating Lua standard library sandboxing using constructors
 * (Lua.empty(), Lua.core(), Lua.full()) and runtime stdlib loaders (loadCore(), loadIo()).
 */
function runStdlibDemo() {
  console.log("=== 1. Lua.empty(): Bare VM without stdlib ===");
  const emptyLua = Lua.empty();
  console.log("Bare expression:", emptyLua.eval("return 10 * 5"));
  // Standard math module is unavailable in empty VM
  try {
    emptyLua.eval("return math.abs(-10)");
  } catch (err: any) {
    console.log("Expected error accessing math in empty VM:", err.message);
  }

  console.log("\n=== 2. Loading Core stdlib dynamically ===");
  emptyLua.loadCore();
  console.log("math.abs(-10) after loadCore():", emptyLua.eval("return math.abs(-10)"));
  console.log("string.upper('hello') after loadCore():", emptyLua.eval("return string.upper('hello')"));

  console.log("\n=== 3. Lua.core(): Preloaded with non-I/O stdlib ===");
  const coreLua = Lua.core();
  console.log("math.sqrt(64):", coreLua.eval("return math.sqrt(64)"));
  console.log("table.concat({'a', 'b', 'c'}, '-'):", coreLua.eval("return table.concat({'a', 'b', 'c'}, '-')"));

  console.log("\n=== 4. Lua.full(): Preloaded with full stdlib including I/O ===");
  const fullLua = Lua.full();
  console.log("Full VM initialized successfully with I/O and core libraries.");
}

runStdlibDemo();
