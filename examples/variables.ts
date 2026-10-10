import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Merged Globals and Variables in Embedded Lua ===");
  const lua = Lua.full();

  // 1. Primitive Globals
  lua.setGlobal("hostName", "localhost");
  lua.setGlobal("port", "8080");

  const serverUrl = lua.eval("return 'http://' .. hostName .. ':' .. port");
  console.log("Constructed server URL:", serverUrl);

  // 2. Complex Lua Objects / Tables
  lua.eval(`
    Server = {
      host = hostName,
      port = port,
      status = "running",
      connections = 12,
      getStatus = function(self)
        return self.host .. ":" .. self.port .. " is " .. self.status .. " with " .. tostring(self.connections) .. " active connections."
      end
    }
  `);

  const statusStr = lua.eval("return Server:getStatus()");
  console.log("Server.getStatus():", statusStr);

  const connCount = lua.eval("return Server.connections");
  console.log("Server.connections:", connCount);
}

main();
