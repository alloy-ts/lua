import { Lua } from "../src/main.ts";

/**
 * Example: Defining Lua Primitive Types, Variables, and Constants from TypeScript using NAPI
 *
 * Questions addressed:
 * How can we define Lua constants and variables from TS using NAPI?
 * - Using `lua.setGlobal(name, value)`, NAPI converts JS primitives into native Lua values and binds them as global variables in Lua's `_G` scope.
 * - TS `const` values passed into `lua.setGlobal` define Lua globals.
 * - In Lua 5.4, local constants can also be defined using `<const>` attribute via `lua.eval("local CONST_NAME <const> = value")`.
 */

function runPrimitivesExample() {
  // Create a Lua state instance (using core standard library)
  const lua = Lua.core();

  console.log("=== 1. Defining Primitive Types in Lua from TS ===");

  // --- String Primitive ---
  const tsString = "Hello from TypeScript!";
  lua.setGlobal("greeting", tsString);
  const luaString = lua.getGlobal("greeting");
  console.log("String:", luaString, "(Type:", typeof luaString, ")");

  // --- Number Primitive (Integer) ---
  const tsInteger = 42;
  lua.setGlobal("itemCount", tsInteger);
  const luaInteger = lua.getGlobal("itemCount");
  console.log("Integer Number:", luaInteger, "(Type:", typeof luaInteger, ")");

  // --- Number Primitive (Float) ---
  const tsFloat = 3.14159;
  lua.setGlobal("pi", tsFloat);
  const luaFloat = lua.getGlobal("pi");
  console.log("Float Number:", luaFloat, "(Type:", typeof luaFloat, ")");

  // --- Boolean Primitive ---
  const tsBoolean = true;
  lua.setGlobal("isActive", tsBoolean);
  const luaBoolean = lua.getGlobal("isActive");
  console.log("Boolean:", luaBoolean, "(Type:", typeof luaBoolean, ")");

  // --- Nil Primitive (from null / undefined) ---
  lua.setGlobal("emptyVal", null);
  const luaNil = lua.getGlobal("emptyVal");
  console.log("Nil (from null):", luaNil, "(Type:", typeof luaNil, ")");

  console.log("\n=== 2. Defining Lua Variables and Modifying Them ===");

  // Define a global variable in Lua from TS
  let score = 100;
  lua.setGlobal("score", score);
  console.log("Initial score set from TS:", lua.getGlobal("score"));

  // Lua code can read and modify the global variable
  lua.eval("score = score + 50");
  console.log("Score after modification in Lua:", lua.getGlobal("score"));

  // Update the global variable from TS again
  score = 250;
  lua.setGlobal("score", score);
  console.log("Score updated again from TS:", lua.getGlobal("score"));

  console.log("\n=== 3. Defining Lua Constants ===");

  // Method A: Set JS `const` as a Lua global constant (by naming convention)
  const MAX_LIMIT = 1000;
  const APP_NAME = "LuaAddonApp";

  lua.setGlobal("MAX_LIMIT", MAX_LIMIT);
  lua.setGlobal("APP_NAME", APP_NAME);

  const limitResult = lua.eval("return 'App ' .. APP_NAME .. ' has max limit ' .. MAX_LIMIT");
  console.log("Constant usage in Lua:", limitResult);

  // Method B: Define scoped constant in Lua 5.4 using `<const>` variable attribute
  const constEvalResult = lua.eval(`
    local MAX_CONNECTIONS <const> = 5
    -- MAX_CONNECTIONS = 10 -- Attempting to reassign MAX_CONNECTIONS in Lua would cause a compile error
    return MAX_CONNECTIONS * 2
  `);
  console.log("Lua 5.4 <const> local variable evaluation result:", constEvalResult);
}

runPrimitivesExample();
