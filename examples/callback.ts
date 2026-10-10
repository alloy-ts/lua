import { Lua } from "../index.js";

// Initialize a Lua VM instance
const lua = Lua.full();

console.log("==================================================");
console.log("Registering JS Host Callbacks in Lua Demo");
console.log("==================================================");

// Register a JS callback function in Lua
lua.registerCallback("hostLogger", () => {
  console.log("  [JS Host Callback Executed] Message logged from Lua!");
});

console.log("Invoking 'hostLogger()' from Lua script...");
lua.eval("hostLogger()");

console.log("\nCalling registered callback in a loop in Lua:");
lua.eval(`
  for i = 1, 3 do
    hostLogger()
  end
`);
