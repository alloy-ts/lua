import { Lua } from "../src/main.ts";

console.log("=== Demo: Standard Library Sandboxing & Modular Loading ===");

// 1. Lua.empty() - Sandboxed VM with zero standard libraries loaded
console.log("\n--- 1. Lua.empty() ---");
const emptyLua = Lua.empty();

// Expression evaluation works natively in the VM
console.log("Empty VM math expression (1 + 1):", emptyLua.eval("return 1 + 1"));

try {
  // `type()` is in the base library and won't be available
  emptyLua.eval("return type('hello')");
} catch (err: any) {
  console.log("Caught error calling type() in empty VM:", err.message);
}

// 2. Incremental loading via loadCore()
console.log("\n--- 2. Loading Core Libraries via loadCore() ---");
emptyLua.loadCore(); // Loads base, string, math, table, coroutine libraries

console.log("Calling type('hello') after loadCore():", emptyLua.eval("return type('hello')"));
console.log("Calling string.upper('hello'):", emptyLua.eval("return string.upper('hello')"));
console.log("Calling math.floor(4.7):", emptyLua.eval("return math.floor(4.7)"));

// 3. Lua.core() vs Lua.full()
console.log("\n--- 3. Sandboxing I/O with Lua.core() vs Lua.full() ---");

const coreLua = Lua.core();
console.log("Checking if 'io' library is loaded in Lua.core():", coreLua.eval("return io ~= nil")); // false

const fullLua = Lua.full();
console.log("Checking if 'io' library is loaded in Lua.full():", fullLua.eval("return io ~= nil")); // true or dependent on VM build

// 4. Loading I/O on demand with loadIo()
console.log("\n--- 4. Loading I/O on demand via loadIo() ---");
console.log("io before loadIo():", coreLua.eval("return io ~= nil"));
coreLua.loadIo();
console.log("io after loadIo():", coreLua.eval("return io ~= nil"));
