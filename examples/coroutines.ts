import { Lua } from "../src/main.ts";

/**
 * Example demonstrating Lua coroutines (cooperative multitasking / yield-resume pattern).
 * In Lua, asynchronous behavior and generator patterns are natively achieved via coroutines.
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
}

runCoroutinesDemo();
