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

  console.log("=== 1. Globals API: Setting Primitives & Functions ===");

  // Set TS primitive values and JS callback functions as Lua globals via Globals API
  lua.globals().set("SERVER_NAME", "Alpha Server");
  lua.globals().set("PORT", 8080);
  lua.globals().set("IS_PRODUCTION", false);
  lua.globals().set("calculateLoad", (base: number, multiplier: number) => base * multiplier);

  // Evaluate in Lua
  const status = lua.eval(
    "return SERVER_NAME .. ' running on port ' .. PORT .. ' (Load: ' .. calculateLoad(10, 5) .. ')'",
  );
  console.log("Status from Lua:", status);

  console.log("\n=== 2. Globals API: Setting Objects & Arrays ===");

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
  lua.globals().set("user", currentUser);

  // Read and mutate object fields in Lua
  lua.eval(`
    user.lastLogin = "2026-10-10"
    table.insert(user.roles, "moderator")
    user.config.maxConnections = user.config.maxConnections + 50
  `);

  // Retrieve modified object back in TS via Globals API
  const updatedUser = lua.globals().get("user") as User & { lastLogin?: string };
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
