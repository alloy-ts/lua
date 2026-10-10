import { Lua } from "../src/main.ts";

/**
 * Example demonstrating how to define Lua primitive types, constants,
 * and variables from TypeScript/JavaScript using lua.globals().
 */
function runPrimitivesDemo() {
  const lua = Lua.full();
  const globals = lua.globals();

  console.log("=== Setting Lua global variables/constants from TS primitives ===");

  // 1. Setting numbers (integers & floats)
  globals.set(lua, "MAX_LIMIT", 100);
  globals.set(lua, "PI", 3.14159);

  // 2. Setting strings
  globals.set(lua, "APP_NAME", "Lua Embedded in TS");

  // 3. Setting booleans
  globals.set(lua, "FEATURE_FLAG", true);

  // 4. Setting null / nil
  globals.set(lua, "EMPTY_VAL", null);

  // Read back variables using globals.get() and eval()
  console.log("MAX_LIMIT via globals.get():", globals.get(lua, "MAX_LIMIT"));
  console.log("PI via globals.get():", globals.get(lua, "PI"));
  console.log("APP_NAME via globals.get():", globals.get(lua, "APP_NAME"));
  console.log("FEATURE_FLAG via globals.get():", globals.get(lua, "FEATURE_FLAG"));
  console.log("EMPTY_VAL via globals.get():", globals.get(lua, "EMPTY_VAL"));

  console.log("\n=== Defining Lua variables / constants using eval ===");

  // Defining local/global variables directly via Lua code
  lua.eval("VERSION = '1.0.0'");
  lua.eval("IS_READY = true");
  lua.eval("COUNTER = 42");

  console.log("VERSION from Lua:", globals.get(lua, "VERSION"));
  console.log("IS_READY from Lua:", globals.get(lua, "IS_READY"));
  console.log("COUNTER from Lua:", globals.get(lua, "COUNTER"));
}

runPrimitivesDemo();
