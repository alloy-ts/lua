import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Error Handling in Embedded Lua ===");
  const lua = Lua.core();

  // 1. Explicit error raised from Lua using error()
  console.log("1. Catching explicit errors raised from Lua:");
  try {
    lua.eval("error('Explicit error raised from Lua!')");
  } catch (e) {
    console.log("   Caught error from lua.eval():", (e as Error).message);
  }

  // 2. Syntax errors during compilation
  console.log("\n2. Catching parse/syntax errors:");
  try {
    lua.eval("invalid lua syntax !!!");
  } catch (e) {
    console.log("   Caught syntax error:", (e as Error).message);
  }

  // 3. Runtime type errors in Lua
  console.log("\n3. Catching runtime type errors:");
  try {
    lua.eval("return 'string' + 10");
  } catch (e) {
    console.log("   Caught runtime type error:", (e as Error).message);
  }
}

main();
