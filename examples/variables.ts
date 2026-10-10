import { Lua } from "../src/main.ts";

/**
 * Example: Comprehensive Guide to Defining Lua Variables, Primitives, Constants, and Objects via NAPI
 *
 * This example merges primitives and objects detailed usage:
 * 1. Primitive types (string, number, boolean, nil/null/undefined)
 * 2. Variables and Constants (JS variable binding, Lua global variables, Lua 5.4 local <const>)
 * 3. Objects & Tables (Keyed TS objects, JS arrays, nested structures, cross-language mutations)
 */

interface ServerConfig {
  host: string;
  port: number;
  endpoints: string[];
  features: {
    auth: boolean;
    logging: boolean;
  };
}

function runVariablesExample() {
  const lua = Lua.core();

  console.log("=================================================");
  console.log("PART 1: PRIMITIVE TYPES (TS/JS -> LUA NAPI)");
  console.log("=================================================");

  // --- String Primitive ---
  const tsString = "Hello from TypeScript via NAPI!";
  lua.setGlobal("greeting", tsString);
  const luaString = lua.getGlobal("greeting");
  console.log("[String] TS -> Lua -> TS:", luaString, `(typeof: ${typeof luaString})`);

  // --- Number Primitives (Integer & Float) ---
  const tsInt = 100;
  const tsFloat = 99.99;
  lua.setGlobal("score", tsInt);
  lua.setGlobal("price", tsFloat);

  const luaInt = lua.getGlobal("score");
  const luaFloat = lua.getGlobal("price");
  console.log("[Integer] score:", luaInt, `(typeof: ${typeof luaInt})`);
  console.log("[Float] price:", luaFloat, `(typeof: ${typeof luaFloat})`);

  // --- Boolean Primitive ---
  const tsBool = true;
  lua.setGlobal("isEnabled", tsBool);
  const luaBool = lua.getGlobal("isEnabled");
  console.log("[Boolean] isEnabled:", luaBool, `(typeof: ${typeof luaBool})`);

  // --- Nil Primitive (from null / undefined) ---
  lua.setGlobal("nothing", null);
  lua.setGlobal("missing", undefined);
  const luaNil1 = lua.getGlobal("nothing");
  const luaNil2 = lua.getGlobal("missing");
  console.log("[Nil from null]:", luaNil1, `(typeof: ${typeof luaNil1})`);
  console.log("[Nil from undefined]:", luaNil2, `(typeof: ${typeof luaNil2})`);

  console.log("\n=================================================");
  console.log("PART 2: VARIABLES AND CONSTANTS IN LUA");
  console.log("=================================================");

  // Dynamic Global Variables
  let count = 1;
  lua.setGlobal("count", count);
  console.log("Initial count in Lua:", lua.getGlobal("count"));

  // Mutate variable in Lua environment
  lua.eval("count = count + 10");
  console.log("Count after Lua evaluation (count + 10):", lua.getGlobal("count"));

  // Re-assign variable from TypeScript
  count = 500;
  lua.setGlobal("count", count);
  console.log("Count after updating from TS:", lua.getGlobal("count"));

  // Defining Constants:
  // 1. By TS value convention (Global constant)
  const API_VERSION = "v2.1.0";
  const MAX_RETRIES = 3;
  lua.setGlobal("API_VERSION", API_VERSION);
  lua.setGlobal("MAX_RETRIES", MAX_RETRIES);

  const constUsage = lua.eval("return 'Connecting to API ' .. API_VERSION .. ' (Max retries: ' .. MAX_RETRIES .. ')'");
  console.log("Constant usage in Lua:", constUsage);

  // 2. By Lua 5.4 local <const> declaration
  const localConstVal = lua.eval(`
    local SECURE_KEY <const> = "secret-token-12345"
    -- SECURE_KEY = "new-key" -- Re-assignment error in Lua
    return "Using key: " .. SECURE_KEY
  `);
  console.log("Lua 5.4 local <const> evaluation:", localConstVal);

  console.log("\n=================================================");
  console.log("PART 3: OBJECTS AND TABLES (TS/JS -> LUA NAPI)");
  console.log("=================================================");

  // Keyed Object -> Lua Table
  const appState = {
    appName: "AlloyLuaEngine",
    version: 1.0,
    debug: false,
  };
  lua.setGlobal("appState", appState);

  console.log("Reading appState.appName in Lua:", lua.eval("return appState.appName"));

  // Mutate object property in Lua
  lua.eval("appState.debug = true");
  lua.eval("appState.status = 'running'"); // Add new property

  const updatedState = lua.getGlobal("appState");
  console.log("Updated appState returned to TS:", updatedState);

  // Array -> Lua Sequential Table (1-indexed)
  const colors = ["red", "green", "blue"];
  lua.setGlobal("colors", colors);

  console.log("colors[1] in Lua (1-indexed):", lua.eval("return colors[1]"));
  console.log("colors length (#colors) in Lua:", lua.eval("return #colors"));

  // Manipulate array table in Lua
  lua.eval("table.insert(colors, 'yellow')");
  const updatedColors = lua.getGlobal("colors");
  console.log("Updated colors array returned to TS:", updatedColors);

  // Complex / Nested Object
  const config: ServerConfig = {
    host: "localhost",
    port: 8080,
    endpoints: ["/api/v1", "/health", "/metrics"],
    features: {
      auth: true,
      logging: true,
    },
  };

  lua.setGlobal("config", config);

  // Query nested fields in Lua
  const hostAndPort = lua.eval("return config.host .. ':' .. config.port");
  const mainEndpoint = lua.eval("return config.endpoints[1]");
  const isAuthOn = lua.eval("return config.features.auth");

  console.log("Nested lookups in Lua -> Endpoint:", String(hostAndPort) + String(mainEndpoint), "| Auth enabled:", isAuthOn);

  // Process nested object in Lua
  lua.eval("config.port = 9090");
  lua.eval("table.insert(config.endpoints, '/status')");

  const finalConfig = lua.getGlobal("config");
  console.log("\nFinal nested config state returned to TS:");
  console.log(JSON.stringify(finalConfig, null, 2));
}

runVariablesExample();
