import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining Lua Object / Table from TS ===");
  const lua = Lua.core();

  lua.setGlobal("appName", "TypeScript Lua Runner");
  lua.setGlobal("env", "production");

  // Define a Lua table / object with methods and properties
  lua.eval(`
    Config = {
      timeout = 5000,
      debug = false,
      getInfo = function(self)
        return appName .. " [env=" .. env .. ", timeout=" .. tostring(self.timeout) .. "ms]"
      end
    }
  `);

  // Invoke method on Lua object
  const info = lua.eval("return Config:getInfo()");
  console.log("Config.getInfo() result:", info);

  // Read property on Lua object
  const timeout = lua.eval("return Config.timeout");
  console.log("Config.timeout property:", timeout);
}

main();
