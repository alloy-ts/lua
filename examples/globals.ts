import { Lua } from "../src/main.ts";

/**
 * Example: Unified Overview of Defining Lua Globals (Primitives, Variables, Constants, and Objects) from TS/JS using NAPI.
 *
 * This example combines primitive data types, variables, constants, and objects/tables into a comprehensive demo.
 */
function runGlobalsExample() {
  console.log("=== Comprehensive Lua Globals Example (Primitives & Objects) ===\n");

  const lua = Lua.full();

  // ==========================================
  // Part 1: Primitive Types & Variables
  // ==========================================
  console.log("--- Part 1: Primitive Types & Global Variables ---");

  // NAPI automatically maps JS/TS primitives to Lua primitives via lua.globals().set():
  // - TS number (integer) -> Lua integer
  // - TS number (float)   -> Lua float (number)
  // - TS string           -> Lua string
  // - TS boolean          -> Lua boolean
  // - TS null / undefined -> Lua nil

  lua.globals().set("appPort", 8080);
  lua.globals().set("pi", 3.14159);
  lua.globals().set("appName", "Lua NAPI Service");
  lua.globals().set("isProduction", false);
  lua.globals().set("deprecatedSetting", null);

  console.log("appName in Lua:", lua.eval("return appName")); // "Lua NAPI Service"
  console.log("appPort in Lua:", lua.eval("return appPort")); // 8080
  console.log("isProduction in Lua:", lua.eval("return isProduction")); // false

  // Modifying variables
  lua.globals().set("appPort", 9090);
  console.log("Updated appPort from TS:", lua.globals().get("appPort")); // 9090

  lua.eval("appPort = appPort + 10");
  console.log("Updated appPort after Lua modification:", lua.globals().get("appPort")); // 9100

  // ==========================================
  // Part 2: Defining Constants
  // ==========================================
  console.log("\n--- Part 2: Defining Constants ---");

  // Method A: TS 'const' passed as Lua global via globals().set()
  const MAX_CONNECTIONS = 500;
  lua.globals().set("MAX_CONNECTIONS", MAX_CONNECTIONS);
  console.log("Constant MAX_CONNECTIONS in Lua:", lua.globals().get("MAX_CONNECTIONS")); // 500

  // Method B: Lua 5.4 local constants using <const>
  const localConstVal = lua.eval(`
    local TIMEOUT <const> = 30
    return TIMEOUT
  `);
  console.log("Lua 5.4 local constant TIMEOUT:", localConstVal); // 30

  // Method C: Read-only table constants via metatable
  lua.eval(`
    CONFIG = setmetatable({}, {
      __index = {
        VERSION = "1.0.0",
        ENV = "staging"
      },
      __newindex = function(_, key, val)
        error("Cannot reassign constant: " .. tostring(key))
      end
    })
  `);
  console.log("Reading CONFIG.VERSION:", lua.eval("return CONFIG.VERSION")); // "1.0.0"

  // ==========================================
  // Part 3: Objects, Arrays & Nested Tables
  // ==========================================
  console.log("\n--- Part 3: Objects, Arrays & Tables ---");

  // Plain TS objects map to keyed Lua tables; TS arrays map to sequential 1-indexed Lua tables
  const serverConfig = {
    host: "localhost",
    ports: [80, 443],
    database: {
      name: "production_db",
      maxPoolSize: 20,
    },
  };

  lua.globals().set("serverConfig", serverConfig);

  console.log("serverConfig.host in Lua:", lua.eval("return serverConfig.host")); // "localhost"
  console.log(
    "serverConfig.ports[1] in Lua (1-indexed):",
    lua.eval("return serverConfig.ports[1]"),
  ); // 80
  console.log("serverConfig.database.name in Lua:", lua.eval("return serverConfig.database.name")); // "production_db"

  // Modifying object inside Lua and reading back in TS
  lua.eval("serverConfig.host = '127.0.0.1'");
  lua.eval("table.insert(serverConfig.ports, 8080)");

  const updatedConfig = lua.globals().get("serverConfig");
  console.log("\nUpdated serverConfig retrieved in TS:");
  console.log(JSON.stringify(updatedConfig, null, 2));
}

runGlobalsExample();
