import { Lua } from "../src/main.ts";

interface Config {
  version: string;
  debug: boolean;
  maxConnections: number;
}

interface User {
  id: number;
  username: string;
  roles: string[];
  config: Config;
}

export function runGlobalsExample() {
  const lua = Lua.full();

  console.log("=== 1. Primitive Globals (Variables & Constants) ===");

  // Set TS primitive values as Lua globals via NAPI
  lua.setGlobal("SERVER_NAME", "Alpha Server");
  lua.setGlobal("PORT", 8080);
  lua.setGlobal("TIMEOUT_SEC", 30.5);
  lua.setGlobal("IS_PRODUCTION", false);

  // Evaluate in Lua
  const status = lua.eval(
    "return SERVER_NAME .. ' running on port ' .. PORT .. ' (Prod: ' .. tostring(IS_PRODUCTION) .. ')'",
  );
  console.log("Status from Lua:", status);

  console.log("\n=== 2. Object Globals (TS/JS Objects & Arrays) ===");

  const currentUser: User = {
    id: 101,
    username: "admin_user",
    roles: ["admin", "developer"],
    config: {
      version: "2.1.0",
      debug: true,
      maxConnections: 100,
    },
  };

  // NAPI converts JS objects -> Lua keyed tables, JS arrays -> 1-indexed Lua sequential tables
  lua.setGlobal("user", currentUser);

  // Read and mutate object fields in Lua
  lua.eval(`
    user.lastLogin = "2026-10-10"
    table.insert(user.roles, "moderator")
    user.config.maxConnections = user.config.maxConnections + 50
  `);

  // Retrieve modified object back in TS
  const updatedUser = lua.getGlobal("user") as User & { lastLogin?: string };
  console.log("Updated User Object from Lua:", updatedUser);

  console.log("\n=== 3. Global State round-trip ===");
  console.log("user.config.maxConnections:", lua.eval("return user.config.maxConnections"));
  console.log("user.roles[3]:", lua.eval("return user.roles[3]"));
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runGlobalsExample();
}
