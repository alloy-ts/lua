import { Lua } from "../src/main.ts";

/**
 * Example demonstrating how to define a Lua object/table from a TS/JS object using NAPI.
 */
function runObjectDemo() {
  const lua = Lua.full();

  console.log("=== Setting Lua global object/table from TS object ===");

  const config = {
    appName: "MyTypeScriptApp",
    version: "2.1.0",
    port: 8080,
    debug: true,
    settings: {
      timeout: 5000,
      retries: 3,
    },
  };

  // Define global object in Lua
  lua.setGlobal("config", config);

  // Access fields of the Lua object/table
  console.log("config.appName:", lua.eval("return config.appName"));
  console.log("config.version:", lua.eval("return config.version"));
  console.log("config.port:", lua.eval("return config.port"));
  console.log("config.debug:", lua.eval("return config.debug"));
  console.log("config.settings.timeout:", lua.eval("return config.settings.timeout"));

  // Mutate object property in Lua
  lua.eval("config.port = 9090");
  console.log("Updated config.port in Lua:", lua.eval("return config.port"));
}

runObjectDemo();
