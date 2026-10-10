import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining a Lua Object from a TypeScript Object ===");

  // Define a TypeScript object with primitive properties, nested objects, and arrays
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

  // Read properties of the object inside a Lua script
  const userInfo = lua.eval(`
    return string.format("User %s (ID: %d) is an %s from %s",
      user.username, user.id, user.roles[1], user.profile.firstName)
  `);
  console.log("Lua evaluated user info:", userInfo);

  console.log("\n=== 2. Modifying Objects in Lua and Reading Back in JS/TS ===");

  // Modify object properties in Lua
  lua.eval(`
    user.profile.age = 29
    user.status = "verified"
    table.insert(user.roles, "lead")
  `);

  // Fetch the modified Lua object back into JavaScript
  const updatedUser = lua.getGlobal("user");
  console.log("Updated user fetched back to TS:", updatedUser);

  console.log("\n=== 3. Returning Objects Created in Lua back to TS ===");

  // Evaluate a Lua script that constructs and returns a nested Lua table/object
  const createdObject = lua.eval(`
    return {
      appName = "LuaNAPI",
      metadata = {
        version = "1.0.0",
        author = "Developer",
        tags = { "embedding", "napi", "wasm" }
      },
      settings = {
        maxMemory = 1024 * 1024,
        enabled = true
      }
    }
  `);
  console.log("Lua object returned to JS:", createdObject);

  console.log("\n=== 4. Defining OOP-style Objects in Lua from TS ===");

  // Define a Lua object prototype with methods using metatables
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

    function Counter:getValue()
      return self.count
    end
  `);

  // Interact with the OOP Lua object
  const finalCount = lua.eval(`
    local c = Counter.new(10)
    c:increment(5)
    c:increment(3)
    return c:getValue()
  `);
  console.log("Counter result from Lua OOP object:", finalCount);
}

main();
