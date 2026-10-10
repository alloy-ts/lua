import { Lua } from "../src/main.ts";

console.log("--- Standard Library Sandboxing ---");

// 1. Lua.empty() - Completely unpopulated environment
console.log("1. Creating Lua.empty()...");
const emptyLua = Lua.empty();
console.log("Basic arithmetic works in empty VM:", emptyLua.eval("return 2 + 3"));
try {
  emptyLua.eval("return type(123)");
} catch (e: any) {
  console.log("`type` standard function is unavailable in empty VM:", e.message);
}

// Dynamically loading core stdlib
console.log("\nLoading core library into empty VM via loadCore()...");
emptyLua.loadCore();
console.log("`type(123)` result after loadCore():", emptyLua.eval("return type(123)"));
console.log("`string.upper('hello')`:", emptyLua.eval("return string.upper('hello')"));

// 2. Lua.core() - Core standard library without I/O
console.log("\n2. Creating Lua.core()...");
const coreLua = Lua.core();
console.log("`math.sqrt(16)` in Lua.core():", coreLua.eval("return math.sqrt(16)"));
console.log(
  "`table.concat({'a', 'b', 'c'}, '-')`:",
  coreLua.eval("return table.concat({'a', 'b', 'c'}, '-')"),
);

// Dynamically loading I/O library
console.log("\nLoading I/O library via loadIo()...");
coreLua.loadIo();
console.log("loadIo() executed successfully.");

// 3. Lua.full() - Full standard library loaded by default
console.log("\n3. Creating Lua.full()...");
const fullLua = Lua.full();
console.log("Full instance math library:", fullLua.eval("return math.abs(-42)"));
console.log("Full instance string library:", fullLua.eval("return string.reverse('Lua')"));
