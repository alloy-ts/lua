import { Lua } from "../index.js";

/**
 * Helper function to simulate a delay in TypeScript/Node.js.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Example demonstrating Lua's cooperative async model using Coroutines
 * (`coroutine.create`, `coroutine.resume`, `coroutine.yield`) combined
 * with TypeScript async/await workflows and `lua.globals()`.
 */
export async function runAsyncCoroutinesExample() {
  const lua = Lua.full();
  const globals = lua.globals();

  console.log("=== Part 1: Basic Coroutine Creation and Yielding ===");

  // Define a generator coroutine in Lua that yields values iteratively
  lua.eval(`
    co = coroutine.create(function(startVal)
      print("[Lua Coroutine] Started with initial value:", startVal)

      for i = 1, 3 do
        local stepData = "Step " .. i .. " output (input doubled: " .. (startVal * i) .. ")"
        print("[Lua Coroutine] Yielding at step", i)
        coroutine.yield(i, stepData)
      end

      return "Finished", 999
    end)
  `);

  console.log("Coroutine status before resume:", lua.eval("return coroutine.status(co)")); // "suspended"

  // Step 1: Resume coroutine with initial argument
  const step1 = lua.eval("return { coroutine.resume(co, 10) }") as [boolean, number, string];
  console.log("TS received from Resume 1:", step1); // [true, 1, "Step 1 output..."]

  // Step 2: Resume coroutine again
  const step2 = lua.eval("return { coroutine.resume(co) }") as [boolean, number, string];
  console.log("TS received from Resume 2:", step2); // [true, 2, "Step 2 output..."]

  // Step 3: Resume coroutine again
  const step3 = lua.eval("return { coroutine.resume(co) }") as [boolean, number, string];
  console.log("TS received from Resume 3:", step3); // [true, 3, "Step 3 output..."]

  // Step 4: Final resume when function returns
  const finalStep = lua.eval("return { coroutine.resume(co) }") as [boolean, string, number];
  console.log("TS received from Final Resume:", finalStep); // [true, "Finished", 999]

  console.log("Coroutine status after completion:", lua.eval("return coroutine.status(co)")); // "dead"

  console.log("\n=== Part 2: Non-Blocking Async Stepping with TS async/await ===");

  // Define an async task processor in Lua
  lua.eval(`
    taskRunner = coroutine.create(function()
      print("[Task] Fetching user metadata...")
      local payload1 = coroutine.yield("FETCH_USER")

      print("[Task] Processing payload:", payload1.name)
      local payload2 = coroutine.yield("SAVE_DATABASE")

      print("[Task] Confirmation received:", payload2.status)
      return "SUCCESS"
    end)
  `);

  // Step A: Start task in Lua
  const action1 = lua.eval("return { coroutine.resume(taskRunner) }") as [boolean, string];
  console.log("[TS Async Loop] Lua requested action:", action1[1]);

  // Simulate async I/O in TypeScript (e.g., HTTP request or DB query)
  await delay(10);
  console.log("[TS Async Loop] Simulated async fetch completed.");

  // Step B: Resume Lua with fetched data
  globals.set("userData", { name: "Alice Developer", id: 42 });
  const action2 = lua.eval("return { coroutine.resume(taskRunner, userData) }") as [
    boolean,
    string,
  ];
  console.log("[TS Async Loop] Lua requested action:", action2[1]);

  // Simulate another async operation
  await delay(10);
  console.log("[TS Async Loop] Simulated async save completed.");

  // Step C: Resume Lua with save result
  globals.set("saveResult", { status: "OK", recordsAffected: 1 });
  const finalResult = lua.eval("return { coroutine.resume(taskRunner, saveResult) }") as [
    boolean,
    string,
  ];
  console.log("[TS Async Loop] Lua task final result:", finalResult[1]); // "SUCCESS"
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  void runAsyncCoroutinesExample();
}
