import { Lua } from "../src/main.ts";

/**
 * Example: Memory Monitoring & Garbage Collection Controls in Lua VM.
 *
 * Demonstrates:
 * - `lua.totalMemory()`: Checking total memory allocated by the Lua VM in bytes.
 * - `lua.gcMetrics()`: Retrieving detailed allocator & GC debt metrics.
 * - `lua.gcCollect()`: Manually triggering a full garbage collection cycle.
 */
function runMemoryExample() {
  console.log("=== Lua Memory & Garbage Collection Example ===\n");

  const lua = Lua.full();

  // 1. Checking initial memory usage
  const initialMemory = lua.totalMemory();
  console.log(`Initial Lua VM memory usage: ${initialMemory} bytes`);

  const initialMetrics = lua.gcMetrics();
  console.log("Initial GC Metrics:", initialMetrics);

  // 2. Allocating a large table in Lua VM to observe memory growth
  console.log("\nAllocating 100,000 table elements in Lua...");
  lua.eval(`
    largeTable = {}
    for i = 1, 100000 do
      largeTable[i] = "item_" .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(
    `Memory after allocation: ${memoryAfterAlloc} bytes (+${memoryAfterAlloc - initialMemory} bytes)`,
  );

  const metricsAfterAlloc = lua.gcMetrics();
  console.log("GC Metrics after allocation:", metricsAfterAlloc);

  // 3. Deallocating table reference in Lua
  console.log("\nDereferencing largeTable in Lua...");
  lua.eval("largeTable = nil");

  // 4. Triggering manual Garbage Collection
  console.log("Triggering manual GC cycle (lua.gcCollect())...");
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  console.log(`Memory after GC collect: ${memoryAfterGC} bytes`);
  console.log(`Reclaimed memory: ${memoryAfterAlloc - memoryAfterGC} bytes`);

  const metricsAfterGC = lua.gcMetrics();
  console.log("Final GC Metrics:", metricsAfterGC);
}

runMemoryExample();
