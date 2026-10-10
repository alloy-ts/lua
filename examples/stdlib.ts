import { Lua } from "../index.js";

console.log("=== Demo: Standard Library Sandboxing & Configurations ===\n");

// 1. Lua.empty() - Completely unprivileged, no stdlib loaded
console.log("--- 1. Lua.empty() ---");
const luaEmpty = Lua.empty();
try {
  luaEmpty.eval("return math.sqrt(64)");
} catch (e: any) {
  console.log("luaEmpty fails when math is not loaded:", e.message);
}

// Dynamically load core stdlib into empty instance
luaEmpty.loadCore();
console.log("After loadCore(), math.sqrt(64) =", luaEmpty.eval("return math.sqrt(64)"));

// 2. Lua.core() - Non-I/O stdlib loaded (math, string, table, coroutine, base)
console.log("\n--- 2. Lua.core() ---");
const luaCore = Lua.core();
console.log(
  "luaCore can perform math & string ops:",
  luaCore.eval("return string.upper('hello ' .. math.max(10, 20))"),
);

// 3. Lua.full() - Full stdlib including I/O modules
console.log("\n--- 3. Lua.full() ---");
const luaFull = new Lua(); // or Lua.full()
console.log("luaFull evaluates successfully:", luaFull.eval("return 'Full stdlib ready'"));
