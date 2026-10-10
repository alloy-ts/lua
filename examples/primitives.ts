import { Lua } from "../index.js";

// Initialize a Lua 5.4 VM instance
const lua = Lua.full();

console.log("=== Defining Lua Variables from JS/TS Primitives ===");

// 1. Numbers (integers & floats)
lua.setGlobal("MAX_CONNECTIONS", 100);
lua.setGlobal("TIMEOUT_SEC", 2.5);

// 2. Strings
lua.setGlobal("APP_NAME", "EmbeddedLuaService");

// 3. Booleans
lua.setGlobal("DEBUG_MODE", true);

// 4. Null / Undefined -> Lua nil
lua.setGlobal("OPTIONAL_CONFIG", null);

// 5. Objects -> Lua Tables
lua.setGlobal("SERVER_CONFIG", {
  host: "127.0.0.1",
  port: 8080,
  tls: false,
});

// 6. Arrays -> Lua Sequential Tables
lua.setGlobal("ALLOWED_ROLES", ["admin", "editor", "viewer"]);

console.log("APP_NAME from Lua:", lua.getGlobal("APP_NAME"));
console.log("SERVER_CONFIG from Lua:", lua.getGlobal("SERVER_CONFIG"));
console.log("ALLOWED_ROLES from Lua:", lua.getGlobal("ALLOWED_ROLES"));

// Verify that Lua scripts can access these variables
const statusReport = lua.eval(`
  return string.format(
    "[%s] Server running on %s:%d (debug=%s, max_conn=%d)",
    APP_NAME,
    SERVER_CONFIG.host,
    SERVER_CONFIG.port,
    tostring(DEBUG_MODE),
    MAX_CONNECTIONS
  )
`);

console.log("Status Report generated in Lua:", statusReport);

console.log("\n=== Defining Lua Constants ===");

// Technique A: Using Lua 5.4 local <const> variables in a script
lua.eval(`
  local MAX_RETRY <const> = 3
  print("Lua local <const> MAX_RETRY = " .. MAX_RETRY)
  -- Un-commenting the line below would raise a compile error in Lua 5.4:
  -- MAX_RETRY = 5
`);

// Technique B: Creating a read-only global constant using a metatable in Lua
lua.eval(`
  function define_constant(name, val)
    local raw_env = _ENV
    rawset(raw_env, name, val)
  end

  define_constant("PI", 3.14159265359)
`);

console.log("Constant PI from Lua:", lua.getGlobal("PI"));
console.log("Calculating circle area in Lua:", lua.eval("return PI * (10 ^ 2)"));
