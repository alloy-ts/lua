import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.full();

  console.log("=== 1. Initial Memory Status ===");
  const initialMemory = lua.totalMemory();
  console.log(
    `Initial Lua VM memory usage: ${initialMemory} bytes (${(initialMemory / 1024).toFixed(2)} KB)`,
  );

  const initialMetrics = lua.gcMetrics();
  console.log("Initial GC Metrics:", initialMetrics);

  console.log("\n=== 2. Allocating Data Structures in Lua ===");

  // Allocate a large table with 100,000 entries inside Lua
  lua.eval(`
    largeTable = {}
    for i = 1, 100000 do
      largeTable[i] = "item_" .. tostring(i) .. "_data_payload"
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(
    `Memory after allocating 100,000 entries: ${memoryAfterAlloc} bytes (${(memoryAfterAlloc / 1024).toFixed(2)} KB)`,
  );
  console.log("Allocated increase:", memoryAfterAlloc - initialMemory, "bytes");

  const metricsAfterAlloc = lua.gcMetrics();
  console.log("GC Metrics after allocation:", metricsAfterAlloc);

  console.log("\n=== 3. Releasing References & Triggering Garbage Collection ===");

  // Clear global reference in Lua to make the table unreachable
  lua.eval("largeTable = nil");

  console.log("Memory before gcCollect():", lua.totalMemory(), "bytes");

  // Trigger full garbage collection cycle
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  console.log(
    `Memory after gcCollect(): ${memoryAfterGC} bytes (${(memoryAfterGC / 1024).toFixed(2)} KB)`,
  );
  console.log("Reclaimed memory:", memoryAfterAlloc - memoryAfterGC, "bytes");

  const finalMetrics = lua.gcMetrics();
  console.log("Final GC Metrics:", finalMetrics);
}

main();
