import { Lua } from "../src/main.ts";

/**
 * Example: Comprehensive Guide to Defining Lua Primitives, Objects, Variables,
 * and Constants from TypeScript using NAPI.
 *
 * Merges detailed usage of primitives and objects into a single global variables demo.
 */
function main() {
  const lua = Lua.full();

  console.log("=================================================");
  console.log("  1. PRIMITIVE TYPES & GLOBAL VARIABLE BINDING  ");
  console.log("=================================================");

  // NAPI maps JS/TS primitives to Lua primitive types:
  // - JS number (integer)   -> Lua integer
  // - JS number (float)     -> Lua float/number
  // - JS string             -> Lua string
  // - JS boolean            -> Lua boolean
  // - JS null / undefined   -> Lua nil

  lua.setGlobal("appVersion", 2);
  lua.setGlobal("pi", 3.14159265);
  lua.setGlobal("environment", "production");
  lua.setGlobal("isDebugEnabled", false);
  lua.setGlobal("deprecatedParam", null);
  lua.setGlobal("unassignedParam", undefined);

  console.log("appVersion (integer):", lua.getGlobal("appVersion"), `[Lua type: ${lua.eval("return math.type(appVersion)")}]`);
  console.log("pi (float):          ", lua.getGlobal("pi"), `[Lua type: ${lua.eval("return math.type(pi)")}]`);
  console.log("environment (string):", lua.getGlobal("environment"), `[Lua type: ${lua.eval("return type(environment)")}]`);
  console.log("isDebugEnabled (bool):", lua.getGlobal("isDebugEnabled"), `[Lua type: ${lua.eval("return type(isDebugEnabled)")}]`);
  console.log("deprecatedParam (nil):", lua.getGlobal("deprecatedParam"), `[Lua val: ${lua.eval("return tostring(deprecatedParam)")}]`);
  console.log("unassignedParam (nil):", lua.getGlobal("unassignedParam"), `[Lua val: ${lua.eval("return tostring(unassignedParam)")}]`);

  console.log("\nEvaluating primitives in Lua:");
  console.log("Expression: pi * appVersion =", lua.eval("return pi * appVersion"));
  console.log("Expression: 'Env: ' .. environment =", lua.eval("return 'Env: ' .. environment"));

  console.log("\n=================================================");
  console.log("  2. DEFINING LUA CONSTANTS FROM TYPESCRIPT     ");
  console.log("=================================================");

  // How to define Lua constants from TS using NAPI?
  //
  // Approach A: Block-scoped / Local Constants (<const>) in Lua 5.4.
  lua.eval(`
    local MAX_MEMORY_LIMIT <const> = 1024
    -- MAX_MEMORY_LIMIT = 2048 -- Reassigning throws a Lua compile/runtime error
    _ENV.MAX_MEMORY_LIMIT = MAX_MEMORY_LIMIT
  `);
  console.log("Constant MAX_MEMORY_LIMIT:", lua.getGlobal("MAX_MEMORY_LIMIT"));

  // Approach B: Read-Only Global Constants via Metatable on _ENV.
  lua.eval(`
    local readOnlyGlobals = {
      SYSTEM_ID = "SYS-9981",
      MAX_WORKERS = 8
    }
    setmetatable(_ENV, {
      __index = readOnlyGlobals,
      __newindex = function(t, k, v)
        if readOnlyGlobals[k] ~= nil then
          error("Attempt to modify read-only global constant: " .. tostring(k))
        else
          rawset(t, k, v)
        end
      end
    })
  `);

  console.log("Global Constant SYSTEM_ID:", lua.eval("return SYSTEM_ID"));
  console.log("Global Constant MAX_WORKERS:", lua.eval("return MAX_WORKERS"));

  try {
    lua.eval("SYSTEM_ID = 'MODIFIED'");
  } catch (err) {
    console.log("Caught expected constant modification error:", (err as Error).message);
  }

  console.log("\n=================================================");
  console.log("  3. OBJECTS, ARRAYS & TABLES IN LUA VIA NAPI   ");
  console.log("=================================================");

  // Can we define a Lua object from TS using NAPI?
  // Yes! NAPI converts JS plain objects and arrays to Lua tables.

  // A. Plain Keyed JS Objects -> Keyed Lua Tables
  const serverConfig = {
    host: "127.0.0.1",
    port: 8080,
    ssl: {
      enabled: true,
      certPath: "/etc/ssl/cert.pem",
    },
  };
  lua.setGlobal("server", serverConfig);

  console.log("Reading server.host in Lua:", lua.eval("return server.host"));
  console.log("Reading server.ssl.certPath in Lua:", lua.eval("return server.ssl.certPath"));

  // B. JS Arrays -> 1-indexed Sequential Lua Tables
  const allowedOrigins = ["https://example.com", "https://api.example.com"];
  lua.setGlobal("allowedOrigins", allowedOrigins);

  console.log("allowedOrigins[1] in Lua (1-indexed):", lua.eval("return allowedOrigins[1]"));
  console.log("Length of allowedOrigins (#allowedOrigins):", lua.eval("return #allowedOrigins"));

  // C. Complex Nested Structure (Objects with Arrays & Sub-objects)
  const applicationState = {
    name: "Alloy Engine",
    version: "1.0.0",
    metrics: {
      requests: 1500,
      errors: 2,
    },
    features: ["auth", "logging", "caching"],
  };
  lua.setGlobal("appState", applicationState);

  console.log("\n=================================================");
  console.log("  4. MUTATING LUA OBJECTS & RETURNING TO TS     ");
  console.log("=================================================");

  // Modify the Lua table from inside a Lua script
  lua.eval(`
    appState.metrics.requests = appState.metrics.requests + 1
    table.insert(appState.features, "metrics_v2")
    appState.status = "HEALTHY"
  `);

  // Retrieve the updated Lua table back into TypeScript as a JS object
  const updatedAppState = lua.getGlobal("appState");
  console.log("Updated Application State retrieved in TypeScript:");
  console.log(JSON.stringify(updatedAppState, null, 2));

  // Evaluating a table constructed entirely within Lua
  const evaluatedLuaTable = lua.eval(`
    return {
      responseCode = 200,
      payload = { items = { "item1", "item2" } }
    }
  `);
  console.log("\nTable evaluated directly from Lua code:", evaluatedLuaTable);
}

main();
