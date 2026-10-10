import { Lua } from "../index.js";

// Create a new Lua instance with stdlib loaded
const lua = new Lua();

console.log("=== Demo: Defining Lua Primitives from TS/JS using NAPI ===\n");

// 1. Defining Lua variables from TS primitives using `setGlobal`
lua.setGlobal("numVal", 42);
lua.setGlobal("floatVal", 3.14159);
lua.setGlobal("strVal", "Hello from TypeScript!");
lua.setGlobal("boolVal", true);
lua.setGlobal("nilVal", null);

console.log("Global 'numVal':", lua.getGlobal("numVal"));
console.log("Global 'floatVal':", lua.getGlobal("floatVal"));
console.log("Global 'strVal':", lua.getGlobal("strVal"));
console.log("Global 'boolVal':", lua.getGlobal("boolVal"));
console.log("Global 'nilVal':", lua.getGlobal("nilVal"));

// 2. Evaluating expressions using the defined TS variables in Lua
const sumResult = lua.eval("return numVal + floatVal");
console.log("numVal + floatVal in Lua:", sumResult);

const concatResult = lua.eval("return strVal .. ' (concatenated in Lua)'");
console.log("String concatenation in Lua:", concatResult);

// 3. Defining Lua 5.4 constants using <const> in Lua code
const constResult = lua.eval(`
  local MAX_CONNECTIONS <const> = 100
  return MAX_CONNECTIONS
`);
console.log("Lua 5.4 <const> variable:", constResult);
