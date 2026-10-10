import { Lua } from "../src/main.ts";

export function runMemoryExample() {
  const lua = Lua.full();

  console.log("=== Memory Monitoring & Garbage Collection Controls ===");

  // 1. Check initial memory footprint
  const initialMemory = lua.totalMemory();
  console.log(`Initial Lua VM Memory: ${initialMemory} bytes`);

  // 2. Allocate data inside Lua state
  lua.eval(`
    largeTable = {}
    for i = 1, 10000 do
      largeTable[i] = "item_" .. i .. "_" .. string.rep("x", 50)
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(
    `Memory after creating 10,000 string elements: ${memoryAfterAlloc} bytes (+${
      memoryAfterAlloc - initialMemory
    } bytes)`,
  );

  // 3. Inspect GC metrics
  const metricsBefore = lua.gcMetrics();
  console.log("GC Metrics Before GC:", metricsBefore);

  // 4. Collect garbage
  lua.eval("largeTable = nil"); // Clear reference in Lua
  lua.gcCollect(); // Trigger garbage collection in VM

  const memoryAfterGC = lua.totalMemory();
  console.log(`Memory after gcCollect(): ${memoryAfterGC} bytes`);

  const metricsAfter = lua.gcMetrics();
  console.log("GC Metrics After GC:", metricsAfter);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runMemoryExample();
}
