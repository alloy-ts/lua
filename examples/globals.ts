import { Lua } from "../index.js";

const lua = new Lua();

console.log(
  "=== Demo: Defining Lua Variables, Constants, Primitives & Objects from TS using NAPI ===\n",
);

// ------------------------------------------------------------------
// 1. Defining Primitives (Numbers, Booleans, Strings, Nil)
// ------------------------------------------------------------------
console.log("--- 1. Primitives & Global Variables ---");
lua.setGlobal("integerVal", 42);
lua.setGlobal("floatVal", 3.14159);
lua.setGlobal("stringVal", "Hello from TypeScript via NAPI!");
lua.setGlobal("booleanVal", true);
lua.setGlobal("nilVal", null);

console.log("Global 'integerVal':", lua.getGlobal("integerVal"));
console.log("Global 'floatVal':", lua.getGlobal("floatVal"));
console.log("Global 'stringVal':", lua.getGlobal("stringVal"));
console.log("Global 'booleanVal':", lua.getGlobal("booleanVal"));
console.log("Global 'nilVal':", lua.getGlobal("nilVal"));

// Arithmetic and string manipulation in Lua using TS variables
console.log("Lua eval (integerVal * 2):", lua.eval("return integerVal * 2"));
console.log("Lua eval (stringVal uppercase):", lua.eval("return string.upper(stringVal)"));

// ------------------------------------------------------------------
// 2. Defining Constants
// ------------------------------------------------------------------
console.log("\n--- 2. Constants ---");
// In Lua 5.4, block-scoped constants are defined with <const>
const constResult = lua.eval(`
  local MAX_LIMIT <const> = 1000
  local API_KEY <const> = "secret-key-123"
  return MAX_LIMIT
`);
console.log("Lua 5.4 local <const> variable:", constResult);

// ------------------------------------------------------------------
// 3. Defining Objects & Tables
// ------------------------------------------------------------------
console.log("\n--- 3. Objects & Nested Tables ---");
const jsConfigObject = {
  appName: "EmbeddedLuaApp",
  version: "1.0.0",
  active: true,
  limits: {
    maxMemoryMb: 512,
    timeoutMs: 1000,
  },
  tags: ["fast", "napi", "embedded"],
};

// Marshal TS Object -> Lua Table via setGlobal
lua.setGlobal("appConfig", jsConfigObject);

console.log("Accessing appConfig.appName in Lua:", lua.eval("return appConfig.appName"));
console.log(
  "Accessing appConfig.limits.maxMemoryMb in Lua:",
  lua.eval("return appConfig.limits.maxMemoryMb"),
);
console.log(
  "Accessing array element in Lua (1-based index):",
  lua.eval("return appConfig.tags[1]"),
);

// Modify object property inside Lua script
lua.eval("appConfig.limits.timeoutMs = 2000");
console.log("Updated timeoutMs in Lua:", lua.eval("return appConfig.limits.timeoutMs"));

// Return newly created Lua table to JS
const luaCreatedObject = lua.eval(`
  return {
    status = "success",
    timestamp = 1600000000,
    data = { id = 99, role = "admin" }
  }
`);
console.log("Returned Lua Object in JS:", luaCreatedObject);
