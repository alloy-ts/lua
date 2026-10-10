import { Lua } from "../src/main.ts";

// Create a new Lua instance with standard libraries loaded
const lua = Lua.full();

console.log("=== 1. Defining Lua Primitive Types from TS/JS Primitives ===");

// Numbers (Integers & Floats)
lua.setGlobal("integerNum", 42);
lua.setGlobal("floatNum", 3.14159);

// Strings
lua.setGlobal("greeting", "Hello from TypeScript!");

// Booleans
lua.setGlobal("isLuaActive", true);
lua.setGlobal("isDisabled", false);

// Null / Undefined -> Lua nil
lua.setGlobal("emptyVal", null);
lua.setGlobal("unassignedVal", undefined);

// Retrieve types and values back from Lua
console.log(
  "integerNum:",
  lua.getGlobal("integerNum"),
  "(Lua type:",
  lua.eval("return type(integerNum)"),
  ")",
);
console.log(
  "floatNum:",
  lua.getGlobal("floatNum"),
  "(Lua type:",
  lua.eval("return type(floatNum)"),
  ")",
);
console.log(
  "greeting:",
  lua.getGlobal("greeting"),
  "(Lua type:",
  lua.eval("return type(greeting)"),
  ")",
);
console.log(
  "isLuaActive:",
  lua.getGlobal("isLuaActive"),
  "(Lua type:",
  lua.eval("return type(isLuaActive)"),
  ")",
);
console.log(
  "emptyVal:",
  lua.getGlobal("emptyVal"),
  "(Lua type:",
  lua.eval("return type(emptyVal)"),
  ")",
);

console.log("\n=== 2. Defining and Mutating Lua Variables ===");

// Define a mutable global variable in Lua from TS
lua.setGlobal("counter", 100);
console.log("Initial counter in TS:", lua.getGlobal("counter"));

// Increment counter directly in Lua script
lua.eval("counter = counter + 5");
console.log("Counter after Lua script increment:", lua.getGlobal("counter"));

// Update variable value from TS using setGlobal
lua.setGlobal("counter", 200);
console.log("Counter after update from TS:", lua.getGlobal("counter"));

console.log("\n=== 3. Defining Lua Constants from TS ===");

// In TypeScript, define a constant and set it in Lua
const MAX_CONNECTIONS = 50;
const API_BASE_URL = "https://api.example.com/v1";

// Bind TS constants to Lua globals
lua.setGlobal("MAX_CONNECTIONS", MAX_CONNECTIONS);
lua.setGlobal("API_BASE_URL", API_BASE_URL);

// Evaluate Lua script using the constants
const connectionMessage = lua.eval(
  "return 'Connecting to ' .. API_BASE_URL .. ' with max ' .. MAX_CONNECTIONS .. ' connections.'",
);
console.log("Lua evaluation output:", connectionMessage);

// Demonstrate creating read-only / constant semantics in Lua using metatables if needed
lua.eval(`
  CONSTANTS = {}
  setmetatable(CONSTANTS, {
    __index = {
      MAX_RETRIES = 3,
      TIMEOUT_MS = 5000
    },
    __newindex = function()
      error("Attempt to modify read-only constants table", 2)
    end
  })
`);

console.log("Lua CONSTANTS.MAX_RETRIES:", lua.eval("return CONSTANTS.MAX_RETRIES"));
