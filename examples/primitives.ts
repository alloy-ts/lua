import { Lua } from "../src/main.ts";

/**
 * Example: Defining Lua Primitives, Variables, and Constants from TypeScript using NAPI
 */
function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining Lua Primitive Variables from TS ===");

  // JS/TS Primitives map directly to Lua types via setGlobal:
  // - JS number (integer)   -> Lua integer
  // - JS number (float)     -> Lua float/number
  // - JS string             -> Lua string
  // - JS boolean            -> Lua boolean
  // - JS null / undefined   -> Lua nil
  lua.setGlobal("intVal", 42);
  lua.setGlobal("floatVal", 3.14159);
  lua.setGlobal("strVal", "Hello from TypeScript!");
  lua.setGlobal("boolVal", true);
  lua.setGlobal("nilValFromNull", null);
  lua.setGlobal("nilValFromUndefined", undefined);

  // Retrieve primitive variables back in TS via getGlobal
  console.log(
    "intVal:",
    lua.getGlobal("intVal"),
    `(type in Lua: ${lua.eval("return type(intVal)")}, math.type: ${lua.eval("return math.type(intVal)")})`,
  );
  console.log(
    "floatVal:",
    lua.getGlobal("floatVal"),
    `(type in Lua: ${lua.eval("return type(floatVal)")}, math.type: ${lua.eval("return math.type(floatVal)")})`,
  );
  console.log(
    "strVal:",
    lua.getGlobal("strVal"),
    `(type in Lua: ${lua.eval("return type(strVal)")})`,
  );
  console.log(
    "boolVal:",
    lua.getGlobal("boolVal"),
    `(type in Lua: ${lua.eval("return type(boolVal)")})`,
  );
  console.log("nilValFromNull:", lua.getGlobal("nilValFromNull"));
  console.log("nilValFromUndefined:", lua.getGlobal("nilValFromUndefined"));

  console.log("\n=== 2. Using Primitives inside Lua Statements & Expressions ===");
  const computed = lua.eval("return intVal * floatVal");
  console.log("intVal * floatVal in Lua =", computed);

  const concatResult = lua.eval("return strVal .. ' (evaluated in Lua)'");
  console.log("String concatenation in Lua =", concatResult);

  console.log("\n=== 3. Defining Constants in Lua from TS ===");
  // Question: How can we define Lua constants and variables from TS using NAPI?
  //
  // Answer:
  // - Variables: Use `lua.setGlobal(name, value)` to define global variables in the Lua VM.
  // - Constants in Lua:
  //   1) Use Lua 5.4 `<const>` attribute in evaluated Lua scripts for block-scoped / local constants.
  //   2) Use a read-only metatable on `_ENV` (proxy table) to prevent global variable reassignment in Lua.

  // Pattern 1: Block-scoped / Local Constants using Lua 5.4 <const>
  lua.eval(`
    local MAX_CONNECTIONS <const> = 100
    -- MAX_CONNECTIONS = 200 -- Reassigning a <const> variable produces a Lua compile/runtime error
    MAX_CONNECTIONS_READ = MAX_CONNECTIONS
  `);
  console.log(
    "MAX_CONNECTIONS defined via Lua 5.4 <const>:",
    lua.getGlobal("MAX_CONNECTIONS_READ"),
  );

  // Pattern 2: Global Read-Only Constants via _ENV Metatable
  lua.eval(`
    local constants = { API_KEY = "SECRET_12345", MAX_RETRY = 5 }
    setmetatable(_ENV, {
      __index = constants,
      __newindex = function(t, k, v)
        if constants[k] ~= nil then
          error("Attempt to reassign read-only constant: " .. tostring(k))
        else
          rawset(t, k, v)
        end
      end
    })
  `);

  console.log("Reading API_KEY in Lua:", lua.eval("return API_KEY"));
  console.log("Reading MAX_RETRY in Lua:", lua.eval("return MAX_RETRY"));

  // Attempting to overwrite a constant in Lua raises an error:
  try {
    lua.eval("API_KEY = 'NEW_VALUE'");
  } catch (err) {
    console.log(
      "Caught expected error when attempting to reassign constant in Lua:",
      (err as Error).message,
    );
  }
}

main();
