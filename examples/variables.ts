import { Lua } from "../src/main.ts";

const lua = new Lua();

console.log("=== Lua Primitives, Variables & Objects ===");

// 1. Defining Primitives & Variables
lua.eval(`
  -- Numbers (integers and floats)
  count = 42
  pi = 3.14159

  -- String
  greeting = "Hello from TypeScript!"

  -- Boolean
  is_active = true

  -- Nil
  nothing = nil
`);

console.log("count:", lua.eval("return count"));
console.log("pi:", lua.eval("return pi"));
console.log("greeting:", lua.eval("return greeting"));
console.log("is_active:", lua.eval("return is_active"));
console.log("nothing:", lua.eval("return nothing"));

// 2. Defining Constants using Lua Metatable Read-only Pattern
lua.eval(`
  local raw_config = {
    MAX_USERS = 1000,
    API_VERSION = "v2"
  }

  CONFIG = setmetatable({}, {
    __index = raw_config,
    __newindex = function()
      error("Attempt to modify read-only constant", 2)
    end
  })
`);

console.log("CONFIG.MAX_USERS:", lua.eval("return CONFIG.MAX_USERS"));
console.log("CONFIG.API_VERSION:", lua.eval("return CONFIG.API_VERSION"));

// 3. Defining Objects (Tables) and Methods
lua.eval(`
  User = {
    id = 101,
    name = "Alice",
    roles = { "admin", "developer" },
    profile = {
      email = "alice@example.com",
      verified = true
    },
    getSummary = function(self)
      return self.name .. " (" .. self.profile.email .. ")"
    end
  }
`);

console.log("User.id:", lua.eval("return User.id"));
console.log("User.name:", lua.eval("return User.name"));
console.log("User.roles[1]:", lua.eval("return User.roles[1]"));
console.log("User.profile.email:", lua.eval("return User.profile.email"));
console.log("User:getSummary():", lua.eval("return User:getSummary()"));
