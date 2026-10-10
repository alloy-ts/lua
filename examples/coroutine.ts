import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Lua Coroutines (Cooperative Concurrency & Yielding) ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Creating and Resuming a Coroutine in Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Creating a Coroutine ---");

  lua.eval(`
    -- Define a generator coroutine that produces numbers on demand
    co = coroutine.create(function(startValue)
      print("Coroutine started with:", startValue)
      for i = 1, 3 do
        print("Yielding step " .. i)
        coroutine.yield(startValue * i)
      end
      return "Coroutine finished!"
    end)
  `);

  console.log("Initial Coroutine Status:", lua.eval("return coroutine.status(co)"));

  // ---------------------------------------------------------------------------
  // 2. Stepping through the Coroutine with coroutine.resume
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Stepping through Yields ---");

  // First resume passes the initial argument to the coroutine function
  let result = lua.eval("return { coroutine.resume(co, 10) }") as [boolean, unknown];
  console.log("Step 1 (resume success, yielded value):", result);
  console.log("Coroutine Status:", lua.eval("return coroutine.status(co)"));

  // Second resume
  result = lua.eval("return { coroutine.resume(co) }") as [boolean, unknown];
  console.log("Step 2 (resume success, yielded value):", result);

  // Third resume
  result = lua.eval("return { coroutine.resume(co) }") as [boolean, unknown];
  console.log("Step 3 (resume success, yielded value):", result);

  // Fourth resume (reaches return statement and finishes)
  result = lua.eval("return { coroutine.resume(co) }") as [boolean, unknown];
  console.log("Final Step (return value):", result);
  console.log("Final Coroutine Status:", lua.eval("return coroutine.status(co)"));

  // ---------------------------------------------------------------------------
  // 3. Helper Function to Consume Lua Generators from TS
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Consuming a Lua Generator Loop in TS ---");

  lua.eval(`
    function createCounter(max)
      return coroutine.create(function()
        for i = 1, max do
          coroutine.yield("Item " .. i)
        end
      end)
    end
    counterCo = createCounter(4)
  `);

  const items: string[] = [];
  while (lua.eval("return coroutine.status(counterCo)") !== "dead") {
    const res = lua.eval("return { coroutine.resume(counterCo) }") as [boolean, string];
    if (res[0] && res[1] !== undefined) {
      items.push(res[1]);
    }
  }

  console.log("Collected items from Lua generator:", items);

  console.log("\n=== Demo Complete ===");
}

main();
