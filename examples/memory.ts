import { Lua } from "../src/main.ts";

console.log("=== Demo: Memory Monitoring and GC Controls in Lua VM ===");

const lua = Lua.full();

// 1. Initial memory usage
const initialMemory = lua.totalMemory();
console.log(`Initial VM Memory Allocation: ${initialMemory} bytes`);

const initialMetrics = lua.gcMetrics();
console.log("Initial GC Metrics:", initialMetrics);

// 2. Allocate data in Lua VM
console.log("\nAllocating large table in Lua VM...");
lua.eval(`
  largeTable = {}
  for i = 1, 10000 do
    largeTable[i] = "Item #" .. tostring(i) .. " with extra text content to consume memory"
  end
`);

const memoryAfterAllocation = lua.totalMemory();
console.log(`Memory after allocation: ${memoryAfterAllocation} bytes`);
console.log(`Memory increase: ${memoryAfterAllocation - initialMemory} bytes`);

const metricsAfterAllocation = lua.gcMetrics();
console.log("GC Metrics after allocation:", metricsAfterAllocation);

// 3. Clear data reference in Lua
console.log("\nClearing table reference in Lua VM...");
lua.eval("largeTable = nil");

const memoryBeforeGC = lua.totalMemory();
console.log(`Memory before GC collection: ${memoryBeforeGC} bytes`);

// 4. Trigger explicit Garbage Collection
console.log("\nRunning manual garbage collection (lua.gcCollect())...");
lua.gcCollect();

const memoryAfterGC = lua.totalMemory();
console.log(`Memory after GC collection: ${memoryAfterGC} bytes`);
console.log(`Freed Memory: ${memoryBeforeGC - memoryAfterGC} bytes`);

const finalMetrics = lua.gcMetrics();
console.log("Final GC Metrics after GC:", finalMetrics);
