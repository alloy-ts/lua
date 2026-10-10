import { Lua } from "../src/main.ts";

console.log("=== 1. Creating Sandboxed Lua Environments ===");

// 1. Completely Empty VM (Sandboxed, no stdlib available)
const emptyLua = Lua.empty();
console.log("Evaluating basic expression in Lua.empty():", emptyLua.eval("return 10 + 20"));

try {
  // `type` is part of base library and should not be available
  emptyLua.eval("return type(10)");
} catch (err) {
  console.log(
    "Expected error in Lua.empty() accessing un-loaded stdlib function:",
    (err as Error).message,
  );
}

// 2. Core VM (base, coroutine, math, string, table; no I/O)
const coreLua = Lua.core();
console.log(
  "String manipulation in Lua.core():",
  coreLua.eval("return string.upper('hello alloy')"),
);
console.log("Math calculation in Lua.core():", coreLua.eval("return math.sqrt(144)"));

// 3. Full VM (all core libraries + I/O stdlib)
const fullLua = Lua.full();
console.log("Checking print function in Lua.full():", fullLua.eval("return print ~= nil"));

console.log("\n=== 2. Incremental Standard Library Loading ===");

// Start with an empty VM and dynamically load capabilities
const dynamicLua = Lua.empty();

console.log("Loading core stdlib...");
dynamicLua.loadCore();
console.log("Core base function available:", dynamicLua.eval("return type('Alloy')"));
console.log("Core math function available:", dynamicLua.eval("return math.floor(9.8)"));

console.log("Loading I/O stdlib...");
dynamicLua.loadIo();
console.log("I/O stdlib print function available:", dynamicLua.eval("return print ~= nil"));
