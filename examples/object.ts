import { Lua } from "../src/main.ts";

const lua = new Lua();

// Define a Lua object (table) from a JS/TS object model
lua.eval(`
  User = {
    name = "Alice",
    age = 30,
    roles = {"admin", "developer"},
    greet = function(self)
      return "Hello, my name is " .. self.name
    end
  }
`);

console.log("User name:", lua.eval("return User.name"));
console.log("User age:", lua.eval("return User.age"));
console.log("User role 1:", lua.eval("return User.roles[1]"));
console.log("User method call:", lua.eval("return User:greet()"));
