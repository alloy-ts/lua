import { Lua } from "../index.js";

/**
 * Example demonstrating how to define Lua primitive types (numbers, strings, booleans, nil)
 * and manage Lua constants and variables from TypeScript using NAPI bindings.
 */
export function runPrimitivesExample() {
  const lua = Lua.full();

  console.log("=== Defining Primitives from TS to Lua using setGlobal ===");

  // 1. Defining Numbers (integers and floats)
  lua.setGlobal("MAX_CONNECTIONS", 100);
  lua.setGlobal("PI", 3.14159);

  // 2. Defining Strings
  lua.setGlobal("SERVICE_NAME", "AuthService");

  // 3. Defining Booleans
  lua.setGlobal("FEATURE_ENABLED", true);

  // 4. Defining nil via null / undefined
  lua.setGlobal("UNSET_VAR", null);

  // Verify defined primitives in Lua environment via eval
  console.log("MAX_CONNECTIONS:", lua.eval("return MAX_CONNECTIONS")); // 100
  console.log("PI:", lua.eval("return PI")); // 3.14159
  console.log("SERVICE_NAME:", lua.eval("return SERVICE_NAME")); // "AuthService"
  console.log("FEATURE_ENABLED:", lua.eval("return FEATURE_ENABLED")); // true
  console.log("UNSET_VAR:", lua.eval("return UNSET_VAR")); // undefined (nil in Lua)

  // Retrieving globals directly via getGlobal
  console.log("getGlobal('SERVICE_NAME'):", lua.getGlobal("SERVICE_NAME")); // "AuthService"

  console.log("\n=== Evaluating Expressions using defined Primitives ===");

  // Use defined globals in Lua logic
  const calculation = lua.eval(
    "return 'Service ' .. SERVICE_NAME .. ' handles up to ' .. (MAX_CONNECTIONS * 2) .. ' requests.'",
  );
  console.log("Lua evaluation output:", calculation);

  console.log("\n=== Defining Constants and Variables in Lua via eval ===");

  // Defining a global variable directly in Lua code
  lua.eval("counter = 1");
  console.log("Initial counter in Lua:", lua.getGlobal("counter"));

  // Mutating a variable in Lua code
  lua.eval("counter = counter + 1");
  console.log("Updated counter in Lua:", lua.getGlobal("counter"));

  // Defining read-only / constant semantics using a frozen table or metatable in Lua
  lua.eval(`
    CONSTANTS = setmetatable({}, {
      __index = { APP_VERSION = "2.1.0", ENV = "production" },
      __newindex = function() error("Attempt to modify read-only constant table") end
    })
  `);

  console.log("Read-only APP_VERSION:", lua.eval("return CONSTANTS.APP_VERSION"));
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runPrimitivesExample();
}
