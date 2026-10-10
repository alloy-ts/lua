import { Lua } from "../index.js";

const lua = new Lua();

console.log("=== Demo: Async & Coroutine Workflows in Embedded Lua ===\n");

// ------------------------------------------------------------------
// 1. Lua Coroutines for Cooperative Multitasking / Async Yielding
// ------------------------------------------------------------------
// Lua natively supports coroutines (cooperative threads) via the coroutine stdlib module.
// Coroutines can yield execution and intermediate results back to the caller,
// allowing async/generator-style task processing.

lua.eval(`
  -- Define an asynchronous-style generator coroutine
  asyncTask = coroutine.create(function(startValue)
    print("  [Lua Coroutine] Starting task with value:", startValue)

    -- Step 1: Perform work and yield progress
    local progress1 = startValue + 10
    coroutine.yield("STEP_1_COMPLETE", progress1)

    -- Step 2: Resume with next stage
    print("  [Lua Coroutine] Resuming step 2...")
    local progress2 = progress1 * 2
    coroutine.yield("STEP_2_COMPLETE", progress2)

    -- Final Return
    print("  [Lua Coroutine] Task finished.")
    return "TASK_FINISHED", progress2 + 100
  end)
`);

// Function to drive the Lua coroutine step-by-step from JS/TS
function stepCoroutine(...resumeArgs: any[]) {
  lua.setGlobal("resumeArgs", resumeArgs);
  const result = lua.eval(`
    local ok, status, val = coroutine.resume(asyncTask, table.unpack(resumeArgs or {}))
    return { ok = ok, status = status, val = val, isAlive = coroutine.status(asyncTask) ~= "dead" }
  `) as { ok: boolean; status: string; val: any; isAlive: boolean };
  return result;
}

console.log("1. Starting coroutine from TypeScript...");
const step1 = stepCoroutine(5);
console.log("   Yield 1 from Lua:", step1);

console.log("\n2. Resuming coroutine step 2 from TypeScript...");
const step2 = stepCoroutine();
console.log("   Yield 2 from Lua:", step2);

console.log("\n3. Resuming coroutine to completion...");
const step3 = stepCoroutine();
console.log("   Final return from Lua:", step3);
