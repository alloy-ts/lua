import { Lua } from "../src/main.ts";

// Helper function to simulate an asynchronous async/await delay in TypeScript
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const lua = Lua.full();

  console.log("=== 1. Basic Lua Coroutines (Yield & Resume) ===");

  // Define a Lua coroutine function that yields intermediate progress steps
  lua.eval(`
    co = coroutine.create(function(startVal)
      print("  [Lua Coroutine] Started with value:", startVal)

      local val1 = coroutine.yield("Step 1 Complete: Processed " .. tostring(startVal))
      print("  [Lua Coroutine] Resumed with:", val1)

      local val2 = coroutine.yield("Step 2 Complete: Received " .. tostring(val1))
      print("  [Lua Coroutine] Resumed again with:", val2)

      return "Final Result: Finished task successfully!"
    end)
  `);

  // Step 1: Initial Resume
  const step1 = lua.eval("return { coroutine.resume(co, 100) }") as [boolean, string];
  console.log("TS received from Step 1 yield:", step1[1]);
  console.log("Coroutine Status:", lua.eval("return coroutine.status(co)"));

  // Step 2: Second Resume
  const step2 = lua.eval("return { coroutine.resume(co, 'data_A') }") as [boolean, string];
  console.log("TS received from Step 2 yield:", step2[1]);

  // Step 3: Final Resume to completion
  const finalResult = lua.eval("return { coroutine.resume(co, 'data_B') }") as [boolean, string];
  console.log("TS received on completion:", finalResult[1]);
  console.log("Coroutine Status after finish:", lua.eval("return coroutine.status(co)"));

  console.log("\n=== 2. Asynchronous Execution Flow with JS Promises & Coroutines ===");

  // Simulate an async workflow engine where Lua yields async request IDs
  lua.eval(`
    asyncTask = coroutine.create(function()
      print("  [Lua Coroutine] Requesting async user data...")
      local user = coroutine.yield({ action = "FETCH_USER", userId = 42 })

      print("  [Lua Coroutine] Received user:", user.name)
      print("  [Lua Coroutine] Requesting async order history...")
      local orders = coroutine.yield({ action = "FETCH_ORDERS", userId = user.id })

      return "Workflow completed for " .. user.name .. " with " .. #orders .. " orders!"
    end)
  `);

  // Runner function that resolves yielded JS Promises and resumes Lua
  async function runLuaAsyncWorkflow() {
    let resumedValue: unknown = undefined;

    while (lua.eval("return coroutine.status(asyncTask)") !== "dead") {
      lua.setGlobal("resumedValue", resumedValue);

      const res = lua.eval("return { coroutine.resume(asyncTask, resumedValue) }") as [
        boolean,
        { action?: string; userId?: number } | string,
      ];

      const success = res[0];
      const yielded = res[1];

      if (!success) {
        throw new Error(`Coroutine error: ${yielded}`);
      }

      if (lua.eval("return coroutine.status(asyncTask)") === "dead") {
        console.log("Async Workflow Finished Result:", yielded);
        break;
      }

      // Handle async actions requested by Lua
      const task = yielded as { action: string; userId: number };
      if (task.action === "FETCH_USER") {
        console.log("TS: Simulating async HTTP request for user", task.userId, "...");
        await delay(100); // Simulate network latency
        resumedValue = { id: task.userId, name: "Alice Smith" };
      } else if (task.action === "FETCH_ORDERS") {
        console.log("TS: Simulating async DB query for orders of user", task.userId, "...");
        await delay(100); // Simulate DB latency
        resumedValue = [
          { orderId: "ORD-001", amount: 150 },
          { orderId: "ORD-002", amount: 200 },
        ];
      }
    }
  }

  await runLuaAsyncWorkflow();
}

void main();
