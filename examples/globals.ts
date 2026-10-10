import { Lua } from "../src/main.ts";

/**
 * Comprehensive example demonstrating how to define Lua constants,
 * primitive variables, and nested objects/tables from TypeScript using NAPI.
 */
function runGlobalsDemo() {
  const lua = Lua.full();

  console.log("=== 1. Defining Lua Primitive Variables & Constants ===");

  // Define primitive types
  lua.setGlobal("SERVER_HOST", "127.0.0.1");
  lua.setGlobal("SERVER_PORT", 8080);
  lua.setGlobal("ENABLE_SSL", true);
  lua.setGlobal("MAX_CONNECTIONS", 1000);
  lua.setGlobal("NULL_CONFIG", null);

  // Evaluate and print values in Lua
  console.log("SERVER_HOST:", lua.eval("return SERVER_HOST"));
  console.log("SERVER_PORT:", lua.eval("return SERVER_PORT"));
  console.log("ENABLE_SSL:", lua.eval("return ENABLE_SSL"));
  console.log("MAX_CONNECTIONS:", lua.eval("return MAX_CONNECTIONS"));
  console.log("NULL_CONFIG:", lua.eval("return NULL_CONFIG"));

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
  lua.setGlobal("user", userProfile);

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
  console.log("Updated SERVER_PORT:", lua.eval("return SERVER_PORT"));
}

runGlobalsDemo();
