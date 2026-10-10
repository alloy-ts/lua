import { Lua } from "../src/main.ts";

export function runCallbackExample() {
  const lua = Lua.full();

  console.log("=== Registering & Executing JS Function Callbacks from Lua ===");

  // 1. Registering JS functions via setGlobal or registerCallback
  lua.setGlobal("jsAdd", (a: number, b: number) => a + b);

  lua.registerCallback("fetchData", (endpoint: string) => {
    console.log(`[JS Callback] Fetching data from endpoint: ${endpoint}`);
    return {
      status: 200,
      data: ["Item A", "Item B", "Item C"],
    };
  });

  // 2. Invoking JS callbacks inside Lua scripts
  const sumResult = lua.eval("return jsAdd(100, 250)");
  console.log("jsAdd(100, 250) called from Lua ->", sumResult);

  // 3. Complex Object / Array exchange in JS Callbacks
  const scriptResult = lua.eval(`
    local response = fetchData("https://api.example.com/items")
    local itemsConcat = table.concat(response.data, ", ")
    return "Status " .. response.status .. ": " .. itemsConcat
  `);

  console.log("Lua script result calling fetchData callback ->", scriptResult);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runCallbackExample();
}
