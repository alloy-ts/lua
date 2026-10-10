import { Lua } from "../src/main.ts";

const lua = new Lua();

// Define Lua primitives from TS primitives by assigning them in Lua context
lua.eval(`
  -- Number
  COUNT = 42
  PI = 3.14159

  -- String
  GREETING = "Hello from TypeScript!"

  -- Boolean
  IS_ENABLED = true

  -- Nil
  EMPTY_VAL = nil
`);

// Demonstrate reading the constants/variables
console.log("COUNT:", lua.eval("return COUNT"));
console.log("PI:", lua.eval("return PI"));
console.log("GREETING:", lua.eval("return GREETING"));
console.log("IS_ENABLED:", lua.eval("return IS_ENABLED"));
console.log("EMPTY_VAL:", lua.eval("return EMPTY_VAL"));

// Constant pattern using metatable read-only protection in Lua
lua.eval(`
  local constants = {}
  local raw = { MAX_CONNECTIONS = 100, VERSION = "1.0.0" }
  setmetatable(constants, {
    __index = raw,
    __newindex = function() error("Attempt to modify read-only constant", 2) end
  })
  APP_CONFIG = constants
`);

console.log("APP_CONFIG.MAX_CONNECTIONS:", lua.eval("return APP_CONFIG.MAX_CONNECTIONS"));
