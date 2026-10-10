import { Lua } from "../index.js";

console.log("==================================================");
console.log("Lua Standard Library Sandboxing Demo");
console.log("==================================================");

// 1. Empty Lua Instance (No stdlib loaded - maximum sandboxing)
console.log("\n1. Creating empty Lua state (Lua.empty())...");
const sandboxed = Lua.empty();

// Core math is unavailable in empty state
try {
  sandboxed.eval("return math.sin(math.pi / 2)");
} catch (err: any) {
  console.log("Expected error accessing 'math' in empty state:", err.message);
}

// 2. Incrementally load core standard library
console.log("\nLoading core stdlib into sandboxed state (loadCore())...");
sandboxed.loadCore();

const mathResult = sandboxed.eval("return math.abs(-42)");
console.log("Math function result after loadCore():", mathResult);

const stringResult = sandboxed.eval("return string.upper('sandboxed lua')");
console.log("String function result after loadCore():", stringResult);

// I/O is still unavailable in core state
try {
  sandboxed.eval("return io");
} catch (err: any) {
  console.log("Expected error accessing 'io' in core state:", err.message);
}

// 3. Load I/O library
console.log("\nLoading I/O stdlib into state (loadIo())...");
sandboxed.loadIo();
console.log("I/O module is now loaded!");

// 4. Core vs Full Factory Constructors
console.log("\n4. Core State (Lua.core()):");
const coreLua = Lua.core();
console.log("Core math available:", coreLua.eval("return math.sqrt(16)")); // 4

console.log("\n5. Full State (Lua.full() / new Lua()):");
const fullLua = Lua.full();
console.log("Full state string upper:", fullLua.eval("return string.reverse('olleh')")); // hello
