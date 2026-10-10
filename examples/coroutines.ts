import { Lua } from "../src/main.ts";

/**
 * Example demonstrating Lua coroutines (cooperative multitasking / yield-resume pattern)
 * and coroutine error handling.
 */
function runCoroutinesDemo() {
  const lua = Lua.full();

  console.log("=== 1. Defining a Generator Coroutine in Lua ===");

  // Define a producer coroutine that yields values sequentially
  lua.eval(`
    co = coroutine.create(function(start, max)
      for i = start, max do
        coroutine.yield(i * 10)
      end
      return "FINISHED"
    end)
  `);

  console.log("Initial status:", lua.eval("return coroutine.status(co)"));

  // Resume the coroutine step-by-step from JS/TS
  let step1 = lua.eval("local ok, val = coroutine.resume(co, 1, 3); return val");
  console.log("Resume #1 value:", step1);

  let step2 = lua.eval("local ok, val = coroutine.resume(co); return val");
  console.log("Resume #2 value:", step2);

  let step3 = lua.eval("local ok, val = coroutine.resume(co); return val");
  console.log("Resume #3 value:", step3);

  let step4 = lua.eval("local ok, val = coroutine.resume(co); return val");
  console.log("Resume #4 (return message):", step4);

  console.log("Final status:", lua.eval("return coroutine.status(co)"));

  console.log("\n=== 2. Coroutine Errors Captured via coroutine.resume ===");

  // In Lua, coroutine.resume acts as a protected call (pcall) for the coroutine thread.
  // Errors inside the thread return false and the error message as the second return value.
  lua.eval(`
    err_co = coroutine.create(function()
      print("Inside coroutine thread before error...")
      error("something went wrong inside coroutine thread")
    end)
  `);

  lua.eval("res_ok, res_err = coroutine.resume(err_co)");

  console.log("coroutine.resume protected status:");
  console.log("  ok:", lua.eval("return res_ok"));
  console.log("  err_msg:", lua.eval("return res_err"));
  console.log("Thread status after error:", lua.eval("return coroutine.status(err_co)"));

  console.log("\n=== 3. Unhandled Thread Error Escaping to JS ===");

  // If a thread function errors without pcall/coroutine.resume handling, or if re-raised via error(res_err)
  try {
    lua.eval("if not res_ok then error(res_err) end");
  } catch (err: any) {
    console.log("Caught coroutine thread error re-raised to JS try/catch:");
    console.log("  Error Message:", err.message);
  }
}

runCoroutinesDemo();
