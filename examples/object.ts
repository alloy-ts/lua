import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.core();

  // Define global variables in the Lua environment
  lua.setGlobal("appName", "My TypeScript App");
  lua.setGlobal("version", "1.0.0");

  // Define a Lua table / object directly using Lua code
  lua.eval(`
    User = {
      name = "Alice",
      role = "Admin",
      greet = function(self)
        return "Hello " .. self.name .. " (" .. self.role .. ") from " .. appName
      end
    }
  `);

  // Evaluate methods on the defined Lua object
  const greeting = lua.eval("return User:greet()");
  console.log("Greeting result:", greeting);

  // Evaluate property access on the object
  const role = lua.eval("return User.role");
  console.log("User role:", role);
}

main();
