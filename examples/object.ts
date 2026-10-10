import { Lua } from "../index.js";

const lua = new Lua();

console.log("=== Demo: Defining Lua Objects from TS/JS using NAPI ===\n");

// 1. Defining a Lua Object (Table) from a JS Object via setGlobal
const tsUserConfig = {
  appName: "LuaApp",
  version: 1.0,
  features: ["eval", "globals", "tables"],
  settings: {
    debug: true,
    maxRetries: 3,
  },
};

// Marshal JS Object -> Lua Table across NAPI bridge
lua.setGlobal("config", tsUserConfig);

// 2. Querying fields of the Lua object inside Lua
console.log("Accessing config.appName in Lua:", lua.eval("return config.appName"));
console.log("Accessing config.settings.debug in Lua:", lua.eval("return config.settings.debug"));

// 3. Modifying the Lua object inside Lua
lua.eval("config.settings.maxRetries = 5");
console.log("Modified maxRetries in Lua:", lua.eval("return config.settings.maxRetries"));

// 4. Returning a newly constructed Lua table back to TS as a JS Object
const createdTable = lua.eval(`
  return {
    status = "ok",
    code = 200,
    server = { host = "localhost", port = 8080 }
  }
`);

console.log("Returned Lua object in JS:", createdTable);
