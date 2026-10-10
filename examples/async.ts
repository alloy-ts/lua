import { Lua } from "../src/main.ts";

export function runAsyncExample() {
  const lua = Lua.full();

  console.log("=== Coroutines and Async Workflows in Lua ===");

  // 1. Defining a Coroutine (Yield / Resume) in Lua
  lua.eval(`
    function createGenerator()
      return coroutine.create(function()
        for i = 1, 3 do
          coroutine.yield("Step " .. i .. " completed")
        end
        return "Generator Finished"
      end)
    end

    co = createGenerator()
  `);

  // 2. Step through coroutine yields from JS/TS
  for (let step = 1; step <= 4; step++) {
    const result = lua.eval(`
      local ok, value = coroutine.resume(co)
      return { ok = ok, value = value, status = coroutine.status(co) }
    `) as { ok: boolean; value: string; status: string };

    console.log(`Step ${step} ->`, result);
  }

  // 3. Simulating Async Tasks / Event-driven Workflows
  console.log("\n=== Simulating Async Task Queue in Lua ===");
  lua.eval(`
    taskQueue = {}

    function addTask(name, duration)
      local co = coroutine.create(function()
        print("Starting task: " .. name)
        coroutine.yield({ status = "pending", progress = 50 })
        print("Finished task: " .. name)
        return { status = "completed", progress = 100 }
      end)
      table.insert(taskQueue, { name = name, co = co })
    end

    addTask("Data Fetch", 100)
    addTask("Image Processing", 250)
  `);

  const pendingTask = lua.eval(`
    local task = taskQueue[1]
    local ok, res = coroutine.resume(task.co)
    return { task = task.name, result = res }
  `);
  console.log("Processing Task 1:", pendingTask);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runAsyncExample();
}
