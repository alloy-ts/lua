import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining Lua Objects/Tables from TS/JS Objects ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Defining Keyed Objects (TypeScript Object -> Lua Keyed Table)
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Passing JS/TS Keyed Objects to Lua ---");

  const config = {
    appName: "AlloyApp",
    version: 1,
    settings: {
      debug: true,
      maxConnections: 100,
    },
  };

  // Pass object to Lua global state via NAPI
  lua.setGlobal("config", config);

  // Access fields inside Lua
  console.log("config.appName from Lua:        ", lua.eval("return config.appName"));
  console.log("config.settings.debug from Lua: ", lua.eval("return config.settings.debug"));
  console.log("config.settings.maxConnections: ", lua.eval("return config.settings.maxConnections"));

  // ---------------------------------------------------------------------------
  // 2. Defining Sequential Arrays (TypeScript Array -> Lua Sequential Table)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Passing JS/TS Arrays to Lua ---");

  const tags = ["typescript", "lua", "napi"];
  lua.setGlobal("tags", tags);

  // Note: Lua tables are 1-indexed for sequential arrays!
  console.log("tags[1] in Lua (1-indexed):", lua.eval("return tags[1]"));
  console.log("tags[2] in Lua (1-indexed):", lua.eval("return tags[2]"));
  console.log("Length of tags in Lua (#tags):", lua.eval("return #tags"));

  // ---------------------------------------------------------------------------
  // 3. Mutating Objects across TS and Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Mutating Object Fields in Lua ---");

  lua.eval("config.version = config.version + 1");
  lua.eval("config.settings.theme = 'dark'");

  // Read updated global back into TS
  const updatedConfig = lua.getGlobal("config");
  console.log("Retrieved updated config from Lua:", updatedConfig);

  // ---------------------------------------------------------------------------
  // 4. Creating Lua Objects/Tables in Lua and Returning to TS
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

  console.log("\n=== Demo Complete ===");
}

main();
