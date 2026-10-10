import { Lua } from "../src/main.ts";

// Instantiate a new Lua VM with full standard libraries
const lua = Lua.full();

// 1. Declare a simple JS utility function and register it as a Lua global
lua.setGlobal("add", (a: number, b: number) => {
  return a + b;
});

// 2. Register a JS function that processes complex objects/tables
lua.setGlobal("formatUser", (user: { name: string; role?: string }) => {
  const role = user.role ?? "User";
  return `[${role.toUpperCase()}] ${user.name}`;
});

// 3. Register a JS logging callback
const logs: string[] = [];
lua.setGlobal("logMessage", (msg: string) => {
  logs.push(`LOG: ${msg}`);
});

// --- Execute Lua code that invokes the registered JS functions ---

// Call scalar function `add`
const sum = lua.eval("return add(15, 27)");
console.log("Sum from JS function called in Lua:", sum); // 42

// Call object formatter `formatUser`
const formatted = lua.eval(`
  local user = { name = "Alice", role = "admin" }
  return formatUser(user)
`);
console.log("Formatted user string:", formatted); // "[ADMIN] Alice"

// Call logging callback from a Lua loop
lua.eval(`
  for i = 1, 3 do
    logMessage("Processing item #" .. i)
  end
`);
console.log("Captured log messages from Lua loop:", logs);
