import { Lua } from "../index.js";

// Initialize a Lua 5.4 VM instance
const lua = Lua.full();
const globals = lua.globals();

console.log("=== Defining Lua Objects from JS/TS Objects ===");

// 1. Define a TypeScript object
interface UserProfile {
  id: number;
  name: string;
  email: string;
  roles: string[];
  metadata: {
    loginCount: number;
    lastLogin: string;
  };
}

const userProfile: UserProfile = {
  id: 1001,
  name: "Alice Smith",
  email: "alice@example.com",
  roles: ["admin", "developer"],
  metadata: {
    loginCount: 42,
    lastLogin: "2026-10-10",
  },
};

// Expose JS object directly as a Lua global table
globals.set("user", userProfile);

console.log("Original User Object set to Lua global 'user':", userProfile);

// 2. Access object properties inside Lua code
const userName = lua.eval("return user.name");
console.log("User name accessed from Lua:", userName);

const secondRole = lua.eval("return user.roles[2]");
console.log("Second role accessed from Lua (1-based index):", secondRole);

const loginCount = lua.eval("return user.metadata.loginCount");
console.log("Login count accessed from Lua:", loginCount);

// 3. Iterate over object key-value pairs inside Lua
console.log("\nIterating over 'user' fields in Lua:");
lua.eval(`
  for key, value in pairs(user) do
    if type(value) ~= "table" then
      print("  " .. tostring(key) .. " => " .. tostring(value))
    end
  end
`);

// 4. Modify object properties inside Lua and retrieve back in TS
lua.eval(`
  user.metadata.loginCount = user.metadata.loginCount + 1
  user.status = "active"
`);

const updatedUser = globals.get("user");
console.log("\nUpdated User Object retrieved from Lua:", updatedUser);

// 5. Creating OOP-style Lua objects with methods from TS data
lua.eval(`
  Person = {}
  Person.__index = Person

  function Person.new(data)
    local self = setmetatable({}, Person)
    self.name = data.name
    self.score = data.score or 0
    return self
  end

  function Person:greet()
    return "Hello, my name is " .. self.name .. " and my score is " .. tostring(self.score)
  end
`);

// Pass JS object to Lua constructor function
globals.set("initialData", { name: "Bob", score: 95 });
const greeting = lua.eval(`
  local p = Person.new(initialData)
  return p:greet()
`);

console.log("\nLua Class Instance method call result:", greeting);
