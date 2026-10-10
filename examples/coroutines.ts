import { Lua } from "../src/main.ts";

// Create a new Lua instance
const lua = Lua.full();

console.log("=== Cooperative Concurrency in Lua via Coroutines ===");

// Lua handles concurrency using coroutines (cooperative multitasking).
// A coroutine can yield values and execution back to the caller and be resumed later.

lua.eval(`
  -- Create a generator coroutine that yields Fibonacci numbers
  fibonacci = coroutine.create(function()
    local a, b = 0, 1
    while true do
      coroutine.yield(a)
      a, b = b, a + b
    end
  end)

  -- Helper function to step the coroutine and get the yielded value
  function nextFib()
    local status, value = coroutine.resume(fibonacci)
    return value
  end
`);

console.log("Stepping Fibonacci generator coroutine from TS:");
for (let i = 1; i <= 8; i++) {
  const fibVal = lua.eval("return nextFib()");
  console.log(`Step ${i}: ${fibVal}`);
}

console.log("\n=== Checking Coroutine Status ===");
const status = lua.eval("return coroutine.status(fibonacci)");
console.log("Coroutine status:", status);
