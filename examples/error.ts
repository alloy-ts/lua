import { Lua } from "../src/main.ts";

/**
 * Example demonstrating Lua error handling and JavaScript try/catch integration.
 *
 * When an error occurs during Lua compilation or execution:
 * 1. Syntax errors or runtime errors in Lua (e.g. error("msg"), assert(false))
 *    are intercepted across the NAPI boundary.
 * 2. They are thrown as native JavaScript `Error` objects that can be caught using standard JS try/catch blocks.
 * 3. Inside Lua, errors can also be caught natively using `pcall` or `xpcall`.
 */
function runErrorHandlingDemo() {
  const lua = Lua.full();

  console.log("=== 1. Catching Lua Syntax Errors in JS try/catch ===");
  try {
    lua.eval("invalid lua syntax !!!");
  } catch (err: any) {
    console.log("Caught Lua syntax error in JS:");
    console.log("  Error Message:", err.message);
  }

  console.log("\n=== 2. Catching Lua Runtime Errors (`error()`) in JS try/catch ===");
  try {
    lua.eval("error('explicit custom error from Lua script')");
  } catch (err: any) {
    console.log("Caught explicit Lua error in JS:");
    console.log("  Error Message:", err.message);
  }

  console.log("\n=== 3. Catching Lua Type/Operator Errors in JS try/catch ===");
  try {
    lua.eval("return nil + 10");
  } catch (err: any) {
    console.log("Caught Lua type error in JS:");
    console.log("  Error Message:", err.message);
  }

  console.log("\n=== 4. Handling Errors Natively Inside Lua with pcall ===");
  lua.eval(`
    ok, res = pcall(function()
      error("internal error trapped by pcall")
    end)
  `);

  console.log("Protected call result inside Lua:");
  console.log("  ok:", lua.eval("return ok"));
  console.log("  error message:", lua.eval("return res"));
}

runErrorHandlingDemo();
