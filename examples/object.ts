import { Lua } from "../src/main.ts";

/**
 * Example: Defining Lua Objects (Tables) from TypeScript/JavaScript using NAPI
 */
function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining Lua Objects from TS Objects via NAPI ===");
  // Question: Can we define a lua object from TS using NAPI?
  //
  // Answer: Yes! JS plain objects and arrays passed to `lua.setGlobal(name, value)`
  // are converted by NAPI into Lua tables.
  // - Plain JS Object -> Keyed Lua Table
  // - JS Array -> Sequential 1-indexed Lua Table
  // - Nested Object/Array -> Nested Lua Table

  // Defining a keyed Lua object (Table)
  const config = {
    appName: "AlloyApp",
    version: 1.2,
    active: true,
  };
  lua.setGlobal("config", config);

  console.log("Config object sent from TS to Lua:");
  console.log("lua.getGlobal('config'):", lua.getGlobal("config"));
  console.log("Reading config.appName in Lua:", lua.eval("return config.appName"));
  console.log("Reading config.version in Lua:", lua.eval("return config.version"));

  console.log("\n=== 2. Defining Lua Arrays from TS Arrays ===");
  // JS arrays are converted to 1-indexed sequential Lua tables.
  const ports = [80, 443, 8080];
  lua.setGlobal("ports", ports);

  console.log("Array sent from TS to Lua:");
  console.log("lua.getGlobal('ports'):", lua.getGlobal("ports"));
  // In Lua, arrays are 1-indexed
  console.log("ports[1] in Lua (1-indexed):", lua.eval("return ports[1]"));
  console.log("#ports in Lua (length):", lua.eval("return #ports"));

  console.log("\n=== 3. Defining Nested Objects & Arrays ===");
  const userProfile = {
    id: 1001,
    username: "johndoe",
    details: {
      email: "john@example.com",
      roles: ["admin", "editor"],
    },
  };
  lua.setGlobal("user", userProfile);

  console.log("Nested user profile in Lua:");
  console.log("user.details.email in Lua:", lua.eval("return user.details.email"));
  console.log("user.details.roles[2] in Lua:", lua.eval("return user.details.roles[2]"));

  console.log("\n=== 4. Modifying Objects in Lua and Retrieving in TS ===");
  // Mutate table properties directly in Lua
  lua.eval(`
    user.details.email = "john.doe@updated.org"
    table.insert(user.details.roles, "reviewer")
    user.lastLogin = "2025-01-01"
  `);

  const updatedUser = lua.getGlobal("user");
  console.log("Updated user object retrieved in TS:", JSON.stringify(updatedUser, null, 2));

  console.log("\n=== 5. Returning Objects Created in Lua to TS ===");
  const luaObject = lua.eval(`
    return {
      status = 200,
      headers = { ["content-type"] = "application/json" },
      tags = { "api", "v1" }
    }
  `);
  console.log("Lua table evaluated and converted to JS object:", luaObject);
}

main();
