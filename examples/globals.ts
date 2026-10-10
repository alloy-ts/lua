import { Lua } from "../src/main.ts";

/**
 * Comprehensive example demonstrating how to define Lua constants,
 * primitive variables, and nested objects/tables from TypeScript using lua.globals().
 */
function runGlobalsDemo() {
  const lua = Lua.full();
  const globals = lua.globals();

  console.log("=== 1. Defining Lua Primitive Variables & Constants ===");

  // Define primitive types via globals.set()
  globals.set(lua, "SERVER_HOST", "127.0.0.1");
  globals.set(lua, "SERVER_PORT", 8080);
  globals.set(lua, "ENABLE_SSL", true);
  globals.set(lua, "MAX_CONNECTIONS", 1000);
  globals.set(lua, "NULL_CONFIG", null);

  // Evaluate and print values in Lua
  console.log("SERVER_HOST:", globals.get(lua, "SERVER_HOST"));
  console.log("SERVER_PORT:", globals.get(lua, "SERVER_PORT"));
  console.log("ENABLE_SSL:", globals.get(lua, "ENABLE_SSL"));
  console.log("MAX_CONNECTIONS:", globals.get(lua, "MAX_CONNECTIONS"));
  console.log("NULL_CONFIG:", globals.get(lua, "NULL_CONFIG"));

  console.log("\n=== 2. Defining Lua Objects / Tables from TS Objects ===");

  // Define a structured TypeScript object
  const userProfile = {
    id: 101,
    username: "alice_dev",
    role: "admin",
    active: true,
    attributes: {
      theme: "dark",
      notifications: true,
      loginCount: 42,
    },
  };

  // Bind the TS object as a global table in Lua
  globals.set(lua, "user", userProfile);

  // Inspect fields from Lua
  console.log("user.id:", lua.eval("return user.id"));
  console.log("user.username:", lua.eval("return user.username"));
  console.log("user.attributes.theme:", lua.eval("return user.attributes.theme"));
  console.log("user.attributes.loginCount:", lua.eval("return user.attributes.loginCount"));

  console.log("\n=== 3. Modifying Lua Variables & Tables in Script ===");

  // Perform operations and updates in Lua script
  lua.eval("user.attributes.loginCount = user.attributes.loginCount + 1");
  lua.eval("user.status = 'ONLINE'");
  lua.eval("SERVER_PORT = 9000");

  console.log("Updated user.attributes.loginCount:", lua.eval("return user.attributes.loginCount"));
  console.log("New user.status field:", lua.eval("return user.status"));
  console.log("Updated SERVER_PORT:", globals.get(lua, "SERVER_PORT"));
}

runGlobalsDemo();
