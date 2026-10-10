import { Lua } from "../src/main.ts";

/**
 * Example: Memory Monitoring and Garbage Collection Controls in Lua VM via NAPI
 */
function main() {
  const lua = Lua.full();

  console.log("=== 1. Checking Initial Memory Allocation ===");
  const initialMemory = lua.totalMemory();
  console.log(`Initial memory usage: ${initialMemory} bytes`);

  console.log("\n=== 2. Allocating Data in Lua VM ===");
  // Create a large table in Lua to consume memory
  lua.eval(`
    largeTable = {}
    for i = 1, 100000 do
      largeTable[i] = "item_" .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(`Memory after allocating 100,000 table items: ${memoryAfterAlloc} bytes`);
  console.log(`Allocated approximately: ${memoryAfterAlloc - initialMemory} bytes`);

  console.log("\n=== 3. Inspecting Garbage Collector Metrics ===");
  let metrics = lua.gcMetrics();
  console.log("GC Metrics before GC run:", {
    totalAllocation: `${metrics.totalAllocation} bytes`,
    allocationDebt: `${metrics.allocationDebt} bytes`,
  });

  console.log("\n=== 4. Clearing Data and Triggering Explicit Garbage Collection ===");
  // Dereference the table in Lua
  lua.eval("largeTable = nil");

  // Trigger a full GC collection cycle
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  console.log(`Memory usage after gcCollect(): ${memoryAfterGC} bytes`);
  console.log(`Freed approximately: ${memoryAfterAlloc - memoryAfterGC} bytes`);

  metrics = lua.gcMetrics();
  console.log("GC Metrics after GC run:", {
    totalAllocation: `${metrics.totalAllocation} bytes`,
    allocationDebt: `${metrics.allocationDebt} bytes`,
  });
}

main();
