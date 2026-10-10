import { Lua } from "../src/main.ts";

/**
 * Example: Memory Monitoring and Garbage Collection Controls
 *
 * Demonstrates:
 * - Checking total Lua VM memory allocation (`lua.totalMemory()`)
 * - Fetching detailed garbage collection metrics (`lua.gcMetrics()`)
 * - Manually triggering garbage collection cycles (`lua.gcCollect()`)
 */

function runMemoryExample() {
  const lua = Lua.full();

  console.log("=== 1. Initial Memory State ===");
  const initialMemory = lua.totalMemory();
  const initialMetrics = lua.gcMetrics();
  console.log(`Initial total memory: ${initialMemory} bytes`);
  console.log(`Initial GC metrics: total_allocation=${initialMetrics.totalAllocation}, allocation_debt=${initialMetrics.allocationDebt}`);

  console.log("\n=== 2. Allocating Data in Lua ===");
  // Allocate a large Lua table containing string data
  lua.eval(`
    largeTable = {}
    for i = 1, 50000 do
      largeTable[i] = "Item string number " .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  const metricsAfterAlloc = lua.gcMetrics();
  console.log(`Memory after creating 50,000 table elements: ${memoryAfterAlloc} bytes`);
  console.log(`GC metrics after alloc: total_allocation=${metricsAfterAlloc.totalAllocation}, allocation_debt=${metricsAfterAlloc.allocationDebt}`);

  console.log("\n=== 3. Releasing Reference & Collecting Garbage ===");
  // Dereference the large table in Lua
  lua.eval("largeTable = nil");

  console.log("Triggering manual GC collection cycle (lua.gcCollect())...");
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  const metricsAfterGC = lua.gcMetrics();
  console.log(`Memory after GC collect: ${memoryAfterGC} bytes`);
  console.log(`GC metrics after GC: total_allocation=${metricsAfterGC.totalAllocation}, allocation_debt=${metricsAfterGC.allocationDebt}`);

  const freedBytes = memoryAfterAlloc - memoryAfterGC;
  console.log(`\nSuccessfully freed approximately ${freedBytes} bytes of memory.`);
}

runMemoryExample();
