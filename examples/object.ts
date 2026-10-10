import { Lua } from "../src/main.ts";

// Create a new Lua instance with full standard library
const lua = Lua.full();

console.log("=== 1. Defining Lua Objects (Keyed Tables) from TS/JS Objects ===");

// Define a plain TypeScript object
const config = {
  appName: "AlloyLuaApp",
  version: "1.0.0",
  debugMode: true,
  maxUsers: 500,
};

// Set as global variable in Lua environment via NAPI
lua.setGlobal("config", config);

// Inspect object structure from Lua
console.log("Reading config object back from Lua:", lua.getGlobal("config"));
console.log("Accessing property via Lua eval:", lua.eval("return config.appName"));
console.log("Accessing numeric property via Lua eval:", lua.eval("return config.maxUsers"));

console.log("\n=== 2. Defining Nested Objects in Lua ===");

// Define a nested object hierarchy
const serverConfig = {
  host: "127.0.0.1",
  port: 8080,
  ssl: {
    enabled: true,
    certPath: "/etc/ssl/certs/server.crt",
  },
  database: {
    driver: "postgres",
    poolSize: 10,
  },
};

lua.setGlobal("server", serverConfig);

console.log("Access nested SSL setting:", lua.eval("return server.ssl.certPath"));
console.log("Access nested DB driver setting:", lua.eval("return server.database.driver"));

console.log("\n=== 3. Defining Arrays (Sequential Tables) from TS/JS Arrays ===");

// Arrays in JS become 1-indexed sequential tables in Lua
const tags = ["typescript", "lua", "napi", "rust"];
lua.setGlobal("tags", tags);

console.log("Reading array back from Lua:", lua.getGlobal("tags"));
console.log("Lua 1-based indexing tags[1]:", lua.eval("return tags[1]"));
console.log("Lua length operator #tags:", lua.eval("return #tags"));

console.log("\n=== 4. Modifying Lua Objects from TS and Lua ===");

// Mutate nested object property in Lua script
lua.eval("server.port = 9090");
lua.eval("server.database.poolSize = server.database.poolSize + 5");

console.log("Updated server port in TS:", lua.getGlobal("server"));
