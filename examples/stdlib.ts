import { Lua } from "../src/main.ts";

console.log("=== Standard Library Sandboxing ===");

// 1. Empty Lua environment (no stdlib loaded)
const emptyLua = Lua.empty();
try {
  emptyLua.eval("return math.abs(-10)");
  console.log("Empty Lua math test failed (unexpectedly succeeded)");
} catch (e: any) {
  console.log("Empty Lua has no math library (expected error):", e.message || e);
}

// 2. Load Core stdlib incrementally into empty environment
emptyLua.loadCore();
console.log("Empty Lua after loadCore(): math.abs(-10) =", emptyLua.eval("return math.abs(-10)"));

try {
  emptyLua.eval("return io.type(io.stdout)");
  console.log("Core Lua IO test failed (unexpectedly succeeded)");
} catch (e: any) {
  console.log("Empty Lua + loadCore() has no IO library (expected error):", e.message || e);
}

// Load IO into emptyLua
emptyLua.loadIo();
console.log("Empty Lua after loadIo(): io library available!");

// 3. Core Lua environment (core stdlib, no I/O)
const coreLua = Lua.core();
console.log("Core Lua string.upper('hello') =", coreLua.eval("return string.upper('hello')"));

try {
  coreLua.eval("return io.type(io.stdout)");
} catch (e: any) {
  console.log("Core Lua has no IO library (sandboxed, expected error):", e.message || e);
}

// 4. Full Lua environment (all stdlib loaded including I/O)
const fullLua = Lua.full();
console.log("Full Lua math.sin(0) =", fullLua.eval("return math.sin(0)"));
