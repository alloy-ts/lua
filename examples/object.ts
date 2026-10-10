import { Lua } from "../src/main.ts";

/**
 * Example: Defining Lua objects from TS/JS objects using NAPI.
 *
 * Question: Can we define a Lua object from TS using NAPI?
 * Answer: Yes! In NAPI, plain JavaScript/TypeScript objects map directly to keyed Lua tables,
 * and TS arrays map to sequential (1-indexed) Lua tables.
 */
function runObjectExample() {
  console.log("=== Lua Object & Table Binding Example ===\n");

  const lua = Lua.full();

  // 1. Defining a Lua table/object from a plain JS/TS object using globals().set()
  const user = {
    id: 101,
    name: "Alice",
    roles: ["admin", "developer"],
    settings: {
      theme: "dark",
      notifications: true,
    },
  };

  // Pass TS object into Lua environment via globals() API
  lua.globals().set("currentUser", user);

  // 2. Accessing properties of the defined object inside Lua
  console.log("Reading object properties in Lua:");
  console.log("User name in Lua:", lua.eval("return currentUser.name")); // "Alice"
  console.log("User theme in Lua:", lua.eval("return currentUser.settings.theme")); // "dark"
  console.log("User first role in Lua (1-indexed):", lua.eval("return currentUser.roles[1]")); // "admin"

  // 3. Modifying the Lua object from Lua script
  console.log("\nModifying object inside Lua script:");
  lua.eval("currentUser.name = 'Alice Smith'");
  lua.eval("currentUser.settings.theme = 'light'");
  lua.eval("table.insert(currentUser.roles, 'maintainer')");

  // Read back modified object in TS/JS
  const updatedUser = lua.globals().get("currentUser");
  console.log("Updated user read back in TypeScript:");
  console.log(JSON.stringify(updatedUser, null, 2));

  // 4. Defining a Lua object with methods using Lua tables & metatables from TS
  console.log("\nDefining a Lua object/class with methods:");
  lua.eval(`
    -- Define a Calculator class/object template in Lua
    Calculator = {}
    Calculator.__index = Calculator

    function Calculator.new(initialValue)
      local self = setmetatable({}, Calculator)
      self.value = initialValue or 0
      return self
    end

    function Calculator:add(n)
      self.value = self.value + n
      return self.value
    end

    function Calculator:getValue()
      return self.value
    end
  `);

  // Interact with Lua object instance
  const calcResult = lua.eval(`
    local calc = Calculator.new(10)
    calc:add(5)
    calc:add(25)
    return calc:getValue()
  `);
  console.log("Calculator object result in Lua:", calcResult); // 40

  // 5. Creating a Lua object table directly via eval and reading it back in TS
  console.log("\nDefining a table directly in Lua and reading in TS:");
  lua.eval(`
    product = {
      sku = "PROD-9988",
      price = 49.99,
      tags = { "electronics", "gadgets" },
      inStock = true
    }
  `);

  const productFromLua = lua.globals().get("product");
  console.log("Product object created in Lua and retrieved in TS:", productFromLua);
}

runObjectExample();
