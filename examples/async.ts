import { Lua } from "../src/main.ts";

// Initialize Lua instance with core/full standard library
const lua = Lua.full();

console.log("=== Demo: Async & Cooperative Multitasking with Lua Coroutines ===");

// 1. Using LuaThread (coroutine handle) directly from TS
lua.eval(`
  function produceData()
    print("Producer started")
    local val1 = coroutine.yield(100)
    print("Producer received val1:", val1[1])
    local val2 = coroutine.yield(val1[1] * 2)
    return "Producer complete!"
  end
`);

const thread = lua.createThread("produceData");
console.log("Initial thread status:", thread.status()); // suspended

const firstYield = thread.resume();
console.log("First yield from thread:", firstYield); // 100

const secondYield = thread.resume([200]);
console.log("Second yield from thread:", secondYield); // 400

const finalResult = thread.resume();
console.log("Final result from thread:", finalResult); // Producer complete!
console.log("Thread status after completion:", thread.status());

console.log("\n=== Demo: Paced Execution with LuaExecutor & Fuel ===");

// 2. Using LuaExecutor to pace infinite or heavy loops with step(fuel)
const executor = lua.executor(`
  local count = 0
  for i = 1, 1000 do
    count = count + i
  end
  return count
`);

let done = false;
let stepCount = 0;
while (!done) {
  stepCount++;
  const res = executor.step(100); // 100 fuel units per step
  done = res.done;
  if (done) {
    console.log(`Executor finished in ${stepCount} steps. Result: ${res.value}`);
  }
}
