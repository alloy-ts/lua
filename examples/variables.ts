import { Lua } from "../index.js";

// Initialize a Lua 5.4 VM instance
const lua = Lua.full();
const globals = lua.globals();

console.log("==================================================");
console.log("1. Defining Lua Primitive Variables via Globals API");
console.log("==================================================");

// Numbers (integers & floats)
globals.set("MAX_CONNECTIONS", 100);
globals.set("TIMEOUT_SEC", 2.5);

// Strings
globals.set("APP_NAME", "EmbeddedLuaService");

// Booleans
globals.set("DEBUG_MODE", true);

// Null / Undefined -> Lua nil
globals.set("OPTIONAL_CONFIG", null);

console.log("APP_NAME from Lua:", globals.get("APP_NAME"));
console.log("MAX_CONNECTIONS from Lua:", globals.get("MAX_CONNECTIONS"));
console.log("TIMEOUT_SEC from Lua:", globals.get("TIMEOUT_SEC"));
console.log("DEBUG_MODE from Lua:", globals.get("DEBUG_MODE"));
console.log("OPTIONAL_CONFIG from Lua:", globals.get("OPTIONAL_CONFIG"));

// Access primitives inside Lua
const statusReport = lua.eval(`
  return string.format(
    "[%s] Configured with max_conn=%d, timeout=%.1fs, debug=%s",
    APP_NAME,
    MAX_CONNECTIONS,
    TIMEOUT_SEC,
    tostring(DEBUG_MODE)
  )
`);
console.log("Status report evaluated in Lua:\n ", statusReport);

console.log("\n==================================================");
console.log("2. Defining Lua Constants");
console.log("==================================================");

// Technique A: Using Lua 5.4 local <const> modifier
lua.eval(`
  local MAX_RETRY <const> = 3
  print("  Lua local <const> MAX_RETRY = " .. MAX_RETRY)
  -- MAX_RETRY = 5  -- Attempting re-assignment in Lua 5.4 raises a compile error
`);

// Technique B: Global constant defined in Lua environment
lua.eval(`
  function define_constant(name, val)
    rawset(_ENV, name, val)
  end

  define_constant("PI", 3.14159265359)
`);

console.log("Constant PI retrieved from Lua:", globals.get("PI"));
console.log("Circle area calculated in Lua:", lua.eval("return PI * (10 ^ 2)"));

console.log("\n==================================================");
console.log("3. Defining Lua Objects and Tables from TS/JS");
console.log("==================================================");

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

// Expose TS object to Lua global 'user'
globals.set("user", userProfile);

console.log("Property 'user.name' from Lua:", lua.eval("return user.name"));
console.log("Array element 'user.roles[2]' from Lua (1-based):", lua.eval("return user.roles[2]"));
console.log("Nested property 'user.metadata.loginCount':", lua.eval("return user.metadata.loginCount"));

console.log("\n==================================================");
console.log("4. Bidirectional Variable Modification");
console.log("==================================================");

// Modify object properties inside Lua code
lua.eval(`
  user.metadata.loginCount = user.metadata.loginCount + 1
  user.status = "active"
`);

// Retrieve modified object back in TypeScript
const updatedUser = globals.get("user");
console.log("Updated User object retrieved back in TS:", updatedUser);

console.log("\n==================================================");
console.log("5. Object-Oriented Patterns with Metatables");
console.log("==================================================");

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

globals.set("personData", { name: "Bob", score: 95 });
const greeting = lua.eval(`
  local p = Person.new(personData)
  return p:greet()
`);

console.log("Lua Metatable method call result:", greeting);
