import { Lua } from "../dist/index.js";

console.log("=== Standard Library Sandboxing ===");

// 1. Lua.empty(): Completely sandboxed VM with no standard libraries
console.log("\n--- 1. Lua.empty() ---");
const emptyLua = Lua.empty();

// Primitive operations like arithmetic work
console.log("1 + 1 =", emptyLua.eval("return 1 + 1")); // 2

// Standard library functions like `type` or `string` do not exist
try {
  emptyLua.eval("return type(123)");
} catch (e) {
  console.log("emptyLua lacks base library functions ('type'):", (e as Error).message);
}

// 2. Incremental loading: loadCore()
console.log("\n--- 2. Incremental loading via loadCore() ---");
emptyLua.loadCore();

// Core libraries (base, string, math, table, coroutine) are now available
console.log("type(123) =", emptyLua.eval("return type(123)")); // "number"
console.log("string.upper('hello') =", emptyLua.eval("return string.upper('hello')")); // "HELLO"
console.log("math.sqrt(16) =", emptyLua.eval("return math.sqrt(16)")); // 4

// But print (I/O library) is not loaded yet
console.log("Is 'print' defined in core?", emptyLua.eval("return print ~= nil")); // false

// 3. Incremental loading: loadIo()
console.log("\n--- 3. Incremental loading via loadIo() ---");
emptyLua.loadIo();
console.log("Is 'print' defined after loadIo()?", emptyLua.eval("return print ~= nil")); // true

// 4. Lua.core() and Lua.full() factory constructors
console.log("\n--- 4. Lua.core() vs Lua.full() ---");
const coreLua = Lua.core();
console.log("Lua.core() has string.len:", coreLua.eval("return string.len('test')")); // 4
console.log("Lua.core() has print:", coreLua.eval("return print ~= nil")); // false

const fullLua = Lua.full(); // or new Lua()
console.log("Lua.full() has print:", fullLua.eval("return print ~= nil")); // true
