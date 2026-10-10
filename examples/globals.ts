import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining Primitive Variables in Lua from TypeScript ===");

  // Numbers (Integers & Floats)
  lua.setGlobal("MAX_CONNECTIONS", 100);
  lua.setGlobal("PI", 3.14159265359);

  // Strings
  lua.setGlobal("APP_NAME", "Lua Embedded Engine");
  lua.setGlobal("VERSION", "1.0.0");

  // Booleans
  lua.setGlobal("DEBUG_MODE", true);
  lua.setGlobal("IS_PRODUCTION", false);

  // Null / Undefined (Mapped to Lua nil)
  lua.setGlobal("UNSET_VAL", null);

  console.log("Read MAX_CONNECTIONS:", lua.getGlobal("MAX_CONNECTIONS"));
  console.log("Read APP_NAME:", lua.getGlobal("APP_NAME"));
  console.log("Read DEBUG_MODE:", lua.getGlobal("DEBUG_MODE"));
  console.log("Read UNSET_VAL:", lua.getGlobal("UNSET_VAL"));

  console.log("\n=== 2. Defining Objects & Arrays in Lua from TypeScript ===");

  const tsUser = {
    id: 101,
    username: "alice",
    profile: {
      firstName: "Alice",
      lastName: "Smith",
      age: 28,
    },
    roles: ["admin", "developer"],
    active: true,
  };

  // Export the TS object to the Lua global state as a Lua table
  lua.setGlobal("user", tsUser);

  // Access object properties in Lua scripts
  const summary = lua.eval(`
    return string.format("User %s (ID: %d) is %s, role: %s, age: %d",
      user.username, user.id, user.profile.firstName, user.roles[1], user.profile.age)
  `);
  console.log("Evaluated summary from Lua:", summary);

  // Modify object fields inside Lua
  lua.eval(`
    user.profile.age = 29
    user.status = "verified"
    table.insert(user.roles, "lead")
  `);

  // Fetch updated object back into TypeScript
  const updatedUser = lua.getGlobal("user");
  console.log("Updated user object fetched back to TS:", updatedUser);

  console.log("\n=== 3. Defining Read-Only Constants in Lua ===");

  // Define read-only constants in Lua using metatables (__newindex restriction)
  lua.eval(`
    CONSTANTS = setmetatable({}, {
      __index = {
        MAX_RETRIES = 5,
        ENVIRONMENT = "staging"
      },
      __newindex = function(_, key, _)
        error("Attempt to modify read-only constant: " .. tostring(key), 2)
      end
    })
  `);

  console.log("Constant ENVIRONMENT:", lua.eval("return CONSTANTS.ENVIRONMENT"));
  console.log("Constant MAX_RETRIES:", lua.eval("return CONSTANTS.MAX_RETRIES"));

  // Attempt to modify constant (will throw error)
  try {
    lua.eval("CONSTANTS.MAX_RETRIES = 10");
  } catch (err) {
    console.log("Caught constant modification error:", (err as Error).message);
  }

  console.log("\n=== 4. Defining OOP Objects with Methods in Lua ===");

  lua.eval(`
    Counter = {}
    Counter.__index = Counter

    function Counter.new(initial)
      local self = setmetatable({}, Counter)
      self.count = initial or 0
      return self
    end

    function Counter:increment(amount)
      self.count = self.count + (amount or 1)
      return self.count
    end
  `);

  const countResult = lua.eval(`
    local c = Counter.new(10)
    c:increment(5)
    return c:increment(3)
  `);
  console.log("Counter result from OOP Lua object:", countResult);
}

main();
