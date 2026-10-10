import { Lua } from "../src/main.ts";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Demo: Asynchronous / Coroutine Patterns in Embedded Lua ===");
  const lua = Lua.core();

  // Define a generator function using Lua coroutines
  lua.eval(`
    function makeTask()
      return coroutine.create(function(startValue)
        local total = startValue
        for i = 1, 3 do
          coroutine.yield("Step " .. tostring(i) .. ": total = " .. tostring(total))
          total = total + (i * 10)
        end
        return "Task complete. Final total = " .. tostring(total)
      end)
    end

    co = makeTask()
  `);

  let status = lua.eval("return coroutine.status(co)");
  console.log("Initial coroutine status:", status);

  let step = 1;
  while (status === "suspended") {
    console.log(`\n[TS Async Step ${step}] Simulating async operation...`);
    await sleep(50);

    const val = lua.eval(`
      local ok, res = coroutine.resume(co, 100)
      return res
    `);
    console.log(`[TS Async Step ${step}] Result from Lua:`, val);

    status = lua.eval("return coroutine.status(co)");
    console.log(`[TS Async Step ${step}] Current coroutine status:`, status);
    step++;
  }
}

main();
