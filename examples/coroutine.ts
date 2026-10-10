import { Lua } from "../src/main.ts";

/**
 * Demo: Lua Coroutines and Cooperative Multitasking (Generators / Async Patterns).
 *
 * Question: Does Lua support async?
 * Answer: Lua supports cooperative multitasking through Coroutines (`coroutine` library).
 * - Lua coroutines allow yielding (`coroutine.yield`) and resuming (`coroutine.resume`) execution state.
 * - While JS uses an event loop with Promises and `async/await`, Lua coroutines act like powerful generators/green threads.
 * - In `@alloy-ts/lua`, `lua.eval()` runs synchronously on the JS main thread, but Lua scripts inside the VM
 *   can utilize coroutines to suspend, resume, and step through cooperative tasks or generators.
 */

export function runCoroutineDemo() {
  const lua = Lua.full();

  console.log("=== 1. Basic Lua Coroutine (Create, Resume, Yield) ===");

  // Define a producer coroutine in Lua that yields values iteratively
  lua.eval(`
    co = coroutine.create(function(start, step)
      local current = start
      for i = 1, 3 do
        coroutine.yield(current)
        current = current + step
      end
      return "done"
    end)
  `);

  // Step through coroutine execution from TS
  const step1 = lua.eval(
    "local ok, val = coroutine.resume(co, 10, 5); return { ok = ok, val = val }",
  ) as {
    ok: boolean;
    val: number;
  };
  const step2 = lua.eval("local ok, val = coroutine.resume(co); return { ok = ok, val = val }") as {
    ok: boolean;
    val: number;
  };
  const step3 = lua.eval("local ok, val = coroutine.resume(co); return { ok = ok, val = val }") as {
    ok: boolean;
    val: number;
  };
  const step4 = lua.eval("local ok, val = coroutine.resume(co); return { ok = ok, val = val }") as {
    ok: boolean;
    val: string;
  };

  const status = lua.eval("return coroutine.status(co)");

  console.log("Step 1 (Yield 10):", step1);
  console.log("Step 2 (Yield 15):", step2);
  console.log("Step 3 (Yield 20):", step3);
  console.log("Step 4 (Return 'done'):", step4);
  console.log(`Coroutine final status: ${status}`); // "dead"

  console.log("\n=== 2. Cooperative Task Scheduler in Lua ===");

  // Define a simple cooperative task queue in Lua using coroutines
  lua.eval(`
    local tasks = {}

    function addTask(fn)
      table.insert(tasks, coroutine.create(fn))
    end

    function runTasks()
      local outputs = {}
      while #tasks > 0 do
        local co = table.remove(tasks, 1)
        local ok, val = coroutine.resume(co)
        if ok and val then
          table.insert(outputs, val)
        end
        if coroutine.status(co) ~= "dead" then
          table.insert(tasks, co)
        end
      end
      return outputs
    end

    addTask(function()
      coroutine.yield("Task A - Step 1")
      return "Task A - Finished"
    end)

    addTask(function()
      coroutine.yield("Task B - Step 1")
      return "Task B - Finished"
    end)
  `);

  const taskResults = lua.eval("return runTasks()");
  console.log("Cooperative Task Execution Results:", taskResults);

  return {
    step1,
    step2,
    step3,
    step4,
    status,
    taskResults,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCoroutineDemo();
}
