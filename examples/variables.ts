import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining Lua Variables, Primitives, Objects, and Constants from TS ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Primitive Type Mapping (TypeScript -> Lua NAPI Conversions)
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Primitive Types Mapping ---");

  // Integer and Float Numbers
  lua.setGlobal("jsInteger", 42);
  lua.setGlobal("jsFloat", 3.14159);

  // Strings
  lua.setGlobal("jsString", "Hello from TypeScript!");

  // Booleans
  lua.setGlobal("jsBool", true);

  // Undefined and Null map to Lua `nil`
  lua.setGlobal("jsUndefined", undefined);
  lua.setGlobal("jsNull", null);

  // Verify how Lua inspects these types
  console.log("jsInteger in Lua type:", lua.eval("return math.type(jsInteger)")); // "integer"
  console.log("jsFloat in Lua type:  ", lua.eval("return math.type(jsFloat)")); // "float"
  console.log("jsString in Lua type: ", lua.eval("return type(jsString)")); // "string"
  console.log("jsBool in Lua type:   ", lua.eval("return type(jsBool)")); // "boolean"
  console.log("jsUndefined in Lua:   ", lua.eval("return type(jsUndefined)")); // "nil"
  console.log("jsNull in Lua:        ", lua.eval("return type(jsNull)")); // "nil"

  // Reading primitives back into TS via `getGlobal` and `eval`
  const retrievedNum = lua.getGlobal("jsInteger");
  const retrievedStr = lua.getGlobal("jsString");
  console.log("Retrieved integer via getGlobal:", retrievedNum, `(type: ${typeof retrievedNum})`);
  console.log("Retrieved string via getGlobal: ", retrievedStr, `(type: ${typeof retrievedStr})`);

  // ---------------------------------------------------------------------------
  // 2. Objects & Tables Mapping
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Objects and Tables Mapping ---");

  // Keyed Objects -> Lua Keyed Tables
  const config = {
    appName: "AlloyApp",
    version: 1,
    settings: {
      debug: true,
      maxConnections: 100,
    },
  };
  lua.setGlobal("config", config);

  console.log("config.appName from Lua:        ", lua.eval("return config.appName"));
  console.log("config.settings.debug from Lua: ", lua.eval("return config.settings.debug"));

  // Sequential Arrays -> Lua 1-Indexed Sequential Tables
  const tags = ["typescript", "lua", "napi"];
  lua.setGlobal("tags", tags);

  console.log("tags[1] in Lua (1-indexed):", lua.eval("return tags[1]"));
  console.log("Length of tags in Lua (#tags):", lua.eval("return #tags"));

  // ---------------------------------------------------------------------------
  // 3. Defining & Mutating Variables in Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Defining & Mutating Variables ---");

  lua.setGlobal("counter", 10);
  console.log("Initial 'counter' set from TS:", lua.getGlobal("counter"));

  lua.eval("counter = counter + 5");
  console.log("Updated 'counter' after Lua execution:", lua.getGlobal("counter"));

  lua.eval("config.version = config.version + 1");
  lua.eval("config.settings.theme = 'dark'");
  console.log("Updated 'config' after Lua execution:", lua.getGlobal("config"));

  lua.eval("greeting = 'Hello, ' .. jsString");
  console.log("Variable 'greeting' created inside Lua:", lua.getGlobal("greeting"));

  // ---------------------------------------------------------------------------
  // 4. Returning Lua Tables/Objects back to TS
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Creating Tables in Lua & Returning to TS ---");

  const userObject = lua.eval(`
    return {
      id = 101,
      username = "jules",
      roles = { "admin", "developer" },
      active = true
    }
  `);

  console.log("Lua table converted to JS Object:", userObject);

  // ---------------------------------------------------------------------------
  // 5. Defining Constants in Lua from TS
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Defining Constants ---");

  // Strategy A: Convention-based constant setting via setGlobal
  const API_VERSION = "v1.2.0";
  lua.setGlobal("API_VERSION", API_VERSION);
  console.log("Constant 'API_VERSION' set from TS:", lua.getGlobal("API_VERSION"));

  // Strategy B: Enforcing read-only constants in Lua environment using metatables
  lua.eval(`
    Constants = setmetatable({}, {
      __index = {
        MAX_RETRIES = 3,
        TIMEOUT_MS = 5000,
        ENV = "production"
      },
      __newindex = function(t, key, value)
        error("Attempt to modify constant variable '" .. tostring(key) .. "'", 2)
      end
    })
  `);

  console.log("Constant Constants.MAX_RETRIES in Lua:", lua.eval("return Constants.MAX_RETRIES"));
  console.log("Constant Constants.ENV in Lua:        ", lua.eval("return Constants.ENV"));

  try {
    lua.eval("Constants.MAX_RETRIES = 10");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log("Successfully prevented modification of Lua constant!");
      console.log("Caught expected error:", err.message);
    }
  }

  console.log("\n=== Demo Complete ===");
}

main();
