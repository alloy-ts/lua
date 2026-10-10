import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Standard Library Sandboxing ===");

  // 1. Empty Lua environment (no stdlib)
  const emptyLua = Lua.empty();
  console.log("--- Lua.empty() ---");
  try {
    emptyLua.eval("return math.abs(-5)");
  } catch (e) {
    console.log("math module unavailable in empty environment:", (e as Error).message);
  }

  // Dynamically load core stdlib
  emptyLua.loadCore();
  console.log("After loadCore(), math.abs(-5) =>", emptyLua.eval("return math.abs(-5)"));

  // 2. Core Lua environment (non-I/O stdlib)
  const coreLua = Lua.core();
  console.log("\n--- Lua.core() ---");
  console.log("string.upper('hello') =>", coreLua.eval("return string.upper('hello')"));

  // 3. Full Lua environment (includes I/O stdlib)
  const fullLua = Lua.full();
  console.log("\n--- Lua.full() ---");
  console.log(
    "Full environment loaded successfully. Total memory:",
    fullLua.totalMemory(),
    "bytes",
  );
}

main();
