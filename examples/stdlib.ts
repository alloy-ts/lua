import { Lua } from "../src/main.ts";

function main() {
  console.log("=== 1. Empty Sandboxed VM (Lua.empty()) ===");

  const emptyLua = Lua.empty();
  console.log("math library in empty VM:", emptyLua.eval("return math")); // undefined
  console.log("string library in empty VM:", emptyLua.eval("return string")); // undefined

  // Basic expressions work without standard libraries
  const sum = emptyLua.eval("return 100 + 200");
  console.log("Basic math in empty VM:", sum);

  console.log("\n=== 2. Progressively Loading Standard Libraries ===");

  // Load core libraries (math, string, table, coroutine)
  emptyLua.loadCore();
  console.log("math.sqrt(144) after loadCore():", emptyLua.eval("return math.sqrt(144)"));
  console.log(
    "string.upper('hello') after loadCore():",
    emptyLua.eval("return string.upper('hello')"),
  );

  // Load I/O library
  emptyLua.loadIo();
  console.log("loadIo() executed successfully");

  console.log("\n=== 3. Core VM Instance (Lua.core()) ===");

  const coreLua = Lua.core();
  console.log("math.pi in Core VM:", coreLua.eval("return math.pi"));
  console.log(
    "table.concat in Core VM:",
    coreLua.eval("return table.concat({'x', 'y', 'z'}, ':')"),
  );

  console.log("\n=== 4. Full VM Instance (Lua.full()) ===");

  const fullLua = Lua.full();
  console.log("math.max in Full VM:", fullLua.eval("return math.max(10, 50, 20)"));
  console.log("string.reverse in Full VM:", fullLua.eval("return string.reverse('embedded lua')"));
}

main();
