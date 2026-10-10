import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining Lua Primitives from TS ===");
  const lua = Lua.core();

  // Define string primitives
  lua.setGlobal("greeting", "Hello from TypeScript!");
  lua.setGlobal("author", "Jules");

  // Evaluate primitive values in Lua
  const str = lua.eval("return greeting .. ' - ' .. author");
  console.log("Evaluated string expression:", str);

  // Evaluate numeric and boolean expressions
  const num = lua.eval("return 42 + 58");
  console.log("Evaluated number expression:", num);

  const bool = lua.eval("return 10 > 5");
  console.log("Evaluated boolean expression:", bool);

  const nilVal = lua.eval("return non_existent_var");
  console.log("Evaluated nil expression:", nilVal);
}

main();
