import { Lua } from "../src/main.ts";

/**
 * Example: Defining Lua primitive types, variables, and constants from TS/JS primitives using NAPI.
 */
function runPrimitivesExample() {
  console.log("=== Lua Primitives & Variables Example ===\n");

  // Create a Lua VM instance
  const lua = Lua.full();

  // 1. Defining Lua primitive types from TS/JS primitives using NAPI and globals() API
  // NAPI automatically converts TS primitive types to corresponding Lua primitives:
  // - TS number (integer)   -> Lua integer
  // - TS number (float)     -> Lua float (number)
  // - TS string             -> Lua string
  // - TS boolean            -> Lua boolean
  // - TS null / undefined   -> Lua nil

  const tsNumInt = 42;
  const tsNumFloat = 3.14159;
  const tsString = "Hello from TypeScript!";
  const tsBool = true;
  const tsNil = null;

  // Define global variables in Lua VM via lua.globals().set()
  lua.globals().set("appPort", tsNumInt);
  lua.globals().set("pi", tsNumFloat);
  lua.globals().set("greeting", tsString);
  lua.globals().set("isDebug", tsBool);
  lua.globals().set("optionalData", tsNil);

  // 2. Accessing defined variables in Lua scripts
  console.log("Reading variables inside Lua:");
  console.log("appPort type in Lua:", lua.eval("return type(appPort)")); // "number"
  console.log("greeting in Lua:", lua.eval("return greeting")); // "Hello from TypeScript!"
  console.log("isDebug in Lua:", lua.eval("return isDebug")); // true
  console.log("optionalData in Lua:", lua.eval("return optionalData")); // undefined (nil in Lua)

  // 3. Modifying Lua global variables from TS and Lua
  console.log("\nModifying global variables:");
  lua.globals().set("appPort", 8080); // Re-assign variable from TS
  console.log("Updated appPort from TS:", lua.globals().get("appPort")); // 8080

  lua.eval("appPort = appPort + 1"); // Re-assign variable inside Lua script
  console.log("Updated appPort after Lua eval:", lua.globals().get("appPort")); // 8081

  // 4. Defining Lua constants from TS
  // How to define constants from TS using NAPI:
  //
  // Option A: TS 'const' bindings pushed as globals via globals().set()
  const MAX_CONNECTIONS = 1000;
  lua.globals().set("MAX_CONNECTIONS", MAX_CONNECTIONS);
  console.log(
    "\nConstant defined via TS const (MAX_CONNECTIONS):",
    lua.globals().get("MAX_CONNECTIONS"),
  );

  // Option B: Native Lua 5.4 local constants using the '<const>' attribute inside scripts
  console.log("\nLua 5.4 local constants (<const>):");
  const constResult = lua.eval(`
    local TIMEOUT <const> = 30
    -- TIMEOUT = 60 -- Attempting to reassign TIMEOUT in Lua would raise a compile/runtime error
    return TIMEOUT
  `);
  console.log("Local constant TIMEOUT in Lua:", constResult); // 30

  // Option C: Read-only Global Constants in Lua via Metatable
  console.log("\nDefining read-only global constants in Lua via metatables:");
  lua.eval(`
    -- Create a read-only table for global constants
    CONFIG = setmetatable({}, {
      __index = {
        API_VERSION = "v1.0.0",
        ENV = "production"
      },
      __newindex = function(_, key, value)
        error("Attempt to modify read-only constant: " .. tostring(key))
      end
    })
  `);

  console.log("Reading CONFIG.API_VERSION:", lua.eval("return CONFIG.API_VERSION")); // "v1.0.0"

  // Attempting to modify read-only constant inside Lua will throw an error:
  try {
    lua.eval("CONFIG.API_VERSION = 'v2.0.0'");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log("Successfully prevented re-assignment of read-only constant:", err.message);
    }
  }
}

runPrimitivesExample();
