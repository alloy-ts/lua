import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining Primitives in Lua from TypeScript ===");

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

  // Objects & Arrays (Mapped to Lua tables)
  lua.setGlobal("SERVER_CONFIG", { host: "127.0.0.1", port: 8080, timeout: 30 });
  lua.setGlobal("ALLOWED_ROLES", ["admin", "editor", "viewer"]);

  console.log("Read MAX_CONNECTIONS from Lua:", lua.getGlobal("MAX_CONNECTIONS"));
  console.log("Read APP_NAME from Lua:", lua.getGlobal("APP_NAME"));
  console.log("Read DEBUG_MODE from Lua:", lua.getGlobal("DEBUG_MODE"));
  console.log("Read SERVER_CONFIG from Lua:", lua.getGlobal("SERVER_CONFIG"));

  console.log("\n=== 2. Using Variables in Lua Scripts ===");

  const appSummary = lua.eval(`
    return string.format("%s v%s running on %s:%d (Debug: %s)",
      APP_NAME, VERSION, SERVER_CONFIG.host, SERVER_CONFIG.port, tostring(DEBUG_MODE))
  `);
  console.log("Lua script result:", appSummary);

  const roleCheck = lua.eval(`
    local role = ALLOWED_ROLES[1]
    return "First allowed role is: " .. role
  `);
  console.log("Role check result:", roleCheck);

  console.log("\n=== 3. Defining Constant Values in Lua Environment ===");

  // Pattern A: Setting global constants and accessing them
  lua.setGlobal("API_KEY", "secret-token-12345");

  // Pattern B: Defining read-only constants in Lua using metatables (__newindex restriction)
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

  // Verify constant protection
  try {
    lua.eval("CONSTANTS.MAX_RETRIES = 10");
  } catch (err) {
    console.log("Caught modification attempt as expected:", (err as Error).message);
  }
}

main();
