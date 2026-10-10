import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Lua VM Memory Management & Garbage Collection ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Initial Memory Usage
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Initial Memory Usage ---");
  const initialMemory = lua.totalMemory();
  console.log(`Initial allocated memory: ${initialMemory} bytes`);

  const initialMetrics = lua.gcMetrics();
  console.log("Initial GC Metrics:", initialMetrics);

  // ---------------------------------------------------------------------------
  // 2. Allocating Memory in Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Allocating Data in Lua ---");

  // Create large tables in Lua to consume memory
  lua.eval(`
    largeData = {}
    for i = 1, 100000 do
      largeData[i] = "Item string number " .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(`Memory after allocating 100,000 items: ${memoryAfterAlloc} bytes`);
  console.log(`Memory increase: +${memoryAfterAlloc - initialMemory} bytes`);

  // ---------------------------------------------------------------------------
  // 3. Triggering Garbage Collection
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Triggering Manual Garbage Collection ---");

  // Dereference the large data in Lua so it becomes garbage
  lua.eval("largeData = nil");

  console.log("Memory before gcCollect():", lua.totalMemory(), "bytes");

  // Trigger full garbage collection cycle
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  console.log("Memory after gcCollect(): ", memoryAfterGC, "bytes");
  console.log(`Memory freed: -${memoryAfterAlloc - memoryAfterGC} bytes`);

  const postGcMetrics = lua.gcMetrics();
  console.log("Post-GC Metrics:", postGcMetrics);

  console.log("\n=== Demo Complete ===");
}

main();
