import { Lua } from "../src/main.ts";

/**
 * Demo: Defining Lua variables, constants, primitives, and objects from TypeScript using NAPI.
 *
 * How NAPI handles TS <-> Lua data types:
 * - Primitives: Numbers (ints/floats), Strings, Booleans pass directly. `null`/`undefined` map to `nil`.
 * - Variables: Global variables in Lua are set via `lua.setGlobal(name, val)` and retrieved via `lua.getGlobal(name)`.
 * - Constants: Can be represented in Lua as read-only variables, capitalized globals, or frozen tables using metatables.
 * - Objects: Plain JS/TS objects map to Lua tables with key-value pairs; JS arrays map to 1-indexed Lua tables.
 */

export function runGlobalsDemo() {
  const lua = Lua.full();

  console.log("=== 1. Primitive Types, Variables & Constants ===");

  // Define global variables from TS primitives
  lua.setGlobal("APP_NAME", "Lua Engine"); // string constant
  lua.setGlobal("MAX_CONNECTIONS", 100); // integer constant
  lua.setGlobal("PI", 3.14159); // float number
  lua.setGlobal("DEBUG_MODE", true); // boolean
  lua.setGlobal("UNUSED_VAR", null); // null -> nil

  // Read primitives back from Lua
  const appName = lua.getGlobal("APP_NAME");
  const maxConn = lua.eval("return MAX_CONNECTIONS");
  const isDebug = lua.getGlobal("DEBUG_MODE");
  const unused = lua.getGlobal("UNUSED_VAR");

  console.log(`APP_NAME: ${appName}`);
  console.log(`MAX_CONNECTIONS: ${maxConn}`);
  console.log(`DEBUG_MODE: ${isDebug}`);
  console.log(`UNUSED_VAR: ${unused}`); // undefined in JS/TS

  // Using variables in Lua calculations
  const scaledMax = lua.eval("return MAX_CONNECTIONS * 2");
  console.log(`Scaled Max Connections: ${scaledMax}`);

  console.log("\n=== 2. Defining Lua Objects / Tables from TS Objects ===");

  interface Config {
    env: string;
    port: number;
    tags: string[];
    db: {
      host: string;
      port: number;
    };
  }

  const serverConfig: Config = {
    env: "production",
    port: 8080,
    tags: ["primary", "us-east"],
    db: {
      host: "localhost",
      port: 5432,
    },
  };

  // Pass TS object into Lua global scope
  lua.setGlobal("config", serverConfig);

  // Access nested properties in Lua
  const dbHost = lua.eval("return config.db.host");
  const primaryTag = lua.eval("return config.tags[1]"); // 1-indexed in Lua

  console.log(`DB Host: ${dbHost}`);
  console.log(`Primary Tag: ${primaryTag}`);

  console.log("\n=== 3. Mutating Lua Objects & Adding Behavior ===");

  // Mutate object properties and array content inside Lua
  lua.eval(`
    config.port = 9090
    config.db.host = "db.internal"
    table.insert(config.tags, "ssl")
  `);

  // Retrieve updated object in TS
  const updatedConfig = lua.getGlobal("config") as Config;
  console.log("Updated Config in TS:", updatedConfig);

  // Attach object methods in Lua
  lua.eval(`
    function config:getSummary()
      return self.env .. ":" .. self.port .. " (" .. self.db.host .. ")"
    end
  `);

  const summary = lua.eval("return config:getSummary()");
  console.log(`Config Summary from Lua Method: ${summary}`);

  return {
    appName,
    maxConn,
    updatedConfig,
    summary,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGlobalsDemo();
}
