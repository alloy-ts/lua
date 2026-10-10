import { Lua } from "../src/main.ts";

/**
 * Example demonstrating Lua memory usage monitoring and garbage collection controls.
 */
function runMemoryDemo() {
  const lua = Lua.full();

  console.log("=== Initial Memory Usage ===");
  console.log("Total Memory (bytes):", lua.totalMemory());
  console.log("GC Metrics:", lua.gcMetrics());

  console.log("\n=== Allocating Data in Lua ===");
  lua.eval(`
    large_table = {}
    for i = 1, 10000 do
      large_table[i] = "item_" .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log("Memory After Allocation (bytes):", memoryAfterAlloc);
  console.log("GC Metrics After Allocation:", lua.gcMetrics());

  console.log("\n=== Clearing Data and Triggering GC ===");
  lua.eval("large_table = nil");
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  console.log("Memory After Garbage Collection (bytes):", memoryAfterGC);
  console.log("GC Metrics After Garbage Collection:", lua.gcMetrics());
  console.log("Freed Memory (bytes):", memoryAfterAlloc - memoryAfterGC);
}

runMemoryDemo();
