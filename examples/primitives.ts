import { Lua } from "../src/main.ts";

/**
 * Example demonstrating how to define Lua primitive types, constants,
 * and variables from TypeScript/JavaScript using NAPI.
 */
function runPrimitivesDemo() {
  const lua = Lua.full();

  console.log("=== Setting Lua global variables/constants from TS primitives ===");

  // 1. Setting numbers (integers & floats)
  lua.setGlobal("MAX_LIMIT", 100);
  lua.setGlobal("PI", 3.14159);

  // 2. Setting strings
  lua.setGlobal("APP_NAME", "Lua Embedded in TS");

  // 3. Setting booleans
  lua.setGlobal("FEATURE_FLAG", true);

  // 4. Setting null / nil
  lua.setGlobal("EMPTY_VAL", null);

  // Read back variables in Lua scripts
  console.log("MAX_LIMIT from Lua:", lua.eval("return MAX_LIMIT"));
  console.log("PI from Lua:", lua.eval("return PI"));
  console.log("APP_NAME from Lua:", lua.eval("return APP_NAME"));
  console.log("FEATURE_FLAG from Lua:", lua.eval("return FEATURE_FLAG"));
  console.log("EMPTY_VAL from Lua:", lua.eval("return EMPTY_VAL"));

  console.log("\n=== Defining Lua variables / constants using eval ===");

  // Defining local/global variables directly via Lua code
  lua.eval("VERSION = '1.0.0'");
  lua.eval("IS_READY = true");
  lua.eval("COUNTER = 42");

  console.log("VERSION from Lua:", lua.eval("return VERSION"));
  console.log("IS_READY from Lua:", lua.eval("return IS_READY"));
  console.log("COUNTER from Lua:", lua.eval("return COUNTER"));
}

runPrimitivesDemo();
