import { Lua } from "../src/main.ts";

// Initialize Lua instance with core/full standard library
const lua = Lua.full();

console.log("=== Demo: Async & Cooperative Multitasking with Lua Coroutines ===");

// Explanation:
// Lua doesn't have a built-in non-blocking event loop or native JS async/await promises.
// Instead, Lua uses cooperative multitasking via coroutines (threads).
// A coroutine can yield execution and control back to the caller and be resumed later.

// 1. Setting up a producer coroutine in Lua
lua.eval(`
  co = coroutine.create(function(startValue)
    print("Coroutine started with:", startValue)

    for i = 1, 3 do
      local yieldVal = startValue * i
      print("Coroutine yielding value:", yieldVal)
      coroutine.yield(yieldVal)
    end

    return "Coroutine finished!"
  end)
`);

// Step through coroutine execution from JS/TS
console.log("Status before resume:", lua.eval("return coroutine.status(co)"));

// Helper function to step coroutine
function stepCoroutine(inputArg?: number) {
  if (inputArg !== undefined) {
    lua.setGlobal("inputArg", inputArg);
    return lua.eval("return { coroutine.resume(co, inputArg) }");
  } else {
    return lua.eval("return { coroutine.resume(co) }");
  }
}

console.log("Step 1 (resume with arg 10):", stepCoroutine(10));
console.log("Status after step 1:", lua.eval("return coroutine.status(co)"));

console.log("Step 2:", stepCoroutine());
console.log("Step 3:", stepCoroutine());
console.log("Step 4 (completion):", stepCoroutine());

console.log("Final Coroutine Status:", lua.eval("return coroutine.status(co)"));

console.log("\n=== Demo: Simulating Async/Await Workflow with TS Promises ===");

// 2. Simulating an async task generator using coroutine steps
lua.eval(`
  asyncTaskCo = coroutine.create(function()
    coroutine.yield({ action = "fetch_data", url = "https://api.example.com/item/1" })
    coroutine.yield({ action = "process_data", delayMs = 100 })
    return { status = "success", result = "Data processed successfully" }
  end)
`);

async function runLuaAsyncTask() {
  let done = false;
  while (!done) {
    const status = lua.eval("return coroutine.status(asyncTaskCo)");
    if (status === "dead") {
      break;
    }

    const res = lua.eval("return { coroutine.resume(asyncTaskCo) }") as [boolean, any];
    const [ok, data] = res;

    if (!ok) {
      console.error("Coroutine error:", data);
      break;
    }

    if (data && typeof data === "object" && data.action) {
      console.log(`[JS Async Handler] Received task request from Lua:`, data);
      // Simulate asynchronous I/O operation in JS/TS
      await new Promise((resolve) => setTimeout(resolve, 50));
    } else {
      console.log(`[JS Async Handler] Coroutine final output:`, data);
      done = true;
    }
  }
}

runLuaAsyncTask().then(() => {
  console.log("Async coroutine workflow complete!");
});
