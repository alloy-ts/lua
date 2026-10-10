import { Lua } from "../src/main.ts";

/**
 * Demo: Memory Monitoring and Garbage Collection in Lua (`examples/memory.ts`).
 *
 * Exposes methods on the `Lua` VM instance:
 * - `totalMemory()`: Returns total memory used by the VM in bytes.
 * - `gcCollect()`: Triggers a full garbage collection cycle.
 * - `gcMetrics()`: Returns GC allocation and debt metrics.
 */

export function runMemoryDemo() {
  const lua = Lua.full();

  console.log("=== 1. Initial Memory Usage ===");
  const initialMemory = lua.totalMemory();
  console.log(`Initial VM Memory: ${initialMemory} bytes`);

  console.log("\n=== 2. Allocating Data in Lua ===");
  // Create a large table in Lua
  lua.eval(`
    largeTable = {}
    for i = 1, 10000 do
      largeTable[i] = "item_" .. i
    end
  `);

  const memoryAfterAlloc = lua.totalMemory();
  console.log(`Memory after allocation: ${memoryAfterAlloc} bytes`);

  console.log("\n=== 3. Checking GC Metrics & Running Garbage Collection ===");
  const metricsBefore = lua.gcMetrics();
  console.log("GC Metrics before GC:", metricsBefore);

  // Clear table reference and collect garbage
  lua.eval("largeTable = nil");
  lua.gcCollect();

  const memoryAfterGC = lua.totalMemory();
  const metricsAfter = lua.gcMetrics();

  console.log(`Memory after GC: ${memoryAfterGC} bytes`);
  console.log("GC Metrics after GC:", metricsAfter);

  return {
    initialMemory,
    memoryAfterAlloc,
    memoryAfterGC,
    metricsBefore,
    metricsAfter,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMemoryDemo();
}
