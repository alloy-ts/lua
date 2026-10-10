import { Lua } from "../src/main.ts";

// Initialize a Lua VM instance with standard library loaded
const lua = Lua.full();

console.log("=== Demo: Defining Lua Primitive Types from TS/JS ===");

// 1. Defining primitive types from TS/JS using NAPI (lua.setGlobal)
lua.setGlobal("appVersion", "1.0.0"); // String -> Lua string
lua.setGlobal("maxConnections", 100); // Integer number -> Lua integer
lua.setGlobal("piValue", 3.14159); // Floating number -> Lua float
lua.setGlobal("isEnabled", true); // Boolean -> Lua boolean
lua.setGlobal("optionalData", null); // null / undefined -> Lua nil

// Read back values from Lua VM via getGlobal
console.log("Global 'appVersion':", lua.getGlobal("appVersion"));
console.log("Global 'maxConnections':", lua.getGlobal("maxConnections"));
console.log("Global 'piValue':", lua.getGlobal("piValue"));
console.log("Global 'isEnabled':", lua.getGlobal("isEnabled"));
console.log("Global 'optionalData':", lua.getGlobal("optionalData")); // undefined in JS

// Evaluate expression in Lua VM using set globals
const summary = lua.eval(
  "return appVersion .. ' (enabled: ' .. tostring(isEnabled) .. ', max: ' .. tostring(maxConnections) .. ')'"
);
console.log("Lua evaluation summary:", summary);

console.log("\n=== Defining Lua Constants and Variables from TS ===");

// A. Global Variables (Mutable by default)
// Globals created via setGlobal are mutable in Lua and JS
lua.setGlobal("counter", 1);
console.log("Initial counter:", lua.getGlobal("counter"));

// Lua script mutates the global variable
lua.eval("counter = counter + 1");
console.log("Counter after Lua increment:", lua.getGlobal("counter"));

// JS updates the global variable
lua.setGlobal("counter", 10);
console.log("Counter updated from JS:", lua.getGlobal("counter"));

// B. Local Variables inside Lua chunks
// Local variables exist within the chunk scope
const localResult = lua.eval(`
  local step = 5
  local result = counter * step
  return result
`);
console.log("Result using Lua local variable:", localResult);

// C. Lua Constants
// 1. Lua 5.4 local constants using <const> modifier:
const constResult = lua.eval(`
  local MAX_LIMIT <const> = 500
  -- MAX_LIMIT = 600 -- Reassigning MAX_LIMIT would throw a Lua compile error
  return MAX_LIMIT
`);
console.log("Lua 5.4 local <const> value:", constResult);

// 2. Read-only / Constant Global Variables via Proxy / Guard logic:
// To define read-only global constants accessible in Lua, we can set up global constants from TS
// and use Lua code or metatable patterns where applicable.
lua.setGlobal("CONFIG_ENV", "production");
lua.setGlobal("MAX_RETRIES", 3);

const checkConstants = lua.eval(`
  -- Verify read-only values in Lua logic
  if CONFIG_ENV == "production" then
    return "Running in production with max retries = " .. tostring(MAX_RETRIES)
  end
`);
console.log("Constant configuration check:", checkConstants);
