import { Lua } from "../src/main.ts";

// Initialize a Lua VM instance with standard library loaded
const lua = Lua.full();

console.log("=== Demo: Defining Lua Objects (Tables) from TS/JS ===");

// 1. Pass a JavaScript Object to Lua via setGlobal
// In Lua, objects are represented as keyed tables (hash maps).
const userProfile = {
  id: 101,
  username: "octocat",
  role: "admin",
  settings: {
    theme: "dark",
    notifications: true,
  },
};

lua.setGlobal("user", userProfile);

// Verify reading the global object back from Lua VM via getGlobal
console.log("Global 'user' fetched back from Lua:", lua.getGlobal("user"));

// Manipulate the object properties inside Lua code
const luaGreeting = lua.eval(`
  return "Hello " .. user.username .. " (" .. user.role .. "), theme: " .. user.settings.theme
`);
console.log("Lua evaluation output:", luaGreeting);

// Mutate object properties from inside Lua script
lua.eval(`
  user.role = "superadmin"
  user.settings.theme = "light"
  user.loginCount = (user.loginCount or 0) + 1
`);

console.log("Global 'user' after Lua mutation:", lua.getGlobal("user"));

console.log("\n=== Demo: Working with JS Arrays in Lua ===");

// 2. Pass a JavaScript Array to Lua via setGlobal
// Arrays are converted into sequential 1-indexed tables in Lua.
const tags = ["typescript", "lua", "napi", "rust"];
lua.setGlobal("tags", tags);

console.log("Global 'tags' array read from Lua:", lua.getGlobal("tags"));

// Access and process 1-indexed Lua array elements
const arraySummary = lua.eval(`
  local result = "Primary tag: " .. tags[1] .. ", Total tags: " .. #tags
  table.insert(tags, "ottavino")
  return result
`);
console.log("Lua array summary:", arraySummary);
console.log("Global 'tags' after table.insert in Lua:", lua.getGlobal("tags"));

console.log("\n=== Demo: Creating Tables in Lua and Returning to TS ===");

// 3. Creating a complex object/table in Lua and returning it to TypeScript
const newObjectFromLua = lua.eval(`
  local config = {
    host = "localhost",
    port = 8080,
    endpoints = { "/api/v1/health", "/api/v1/data" },
    active = true
  }
  return config
`);

console.log("Object generated in Lua and returned to TS:", newObjectFromLua);
