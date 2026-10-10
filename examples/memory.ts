import { Lua } from "../dist/index.js";

console.log("=== Memory Monitoring & Garbage Collection ===");

const lua = Lua.full();

// 1. Check initial memory usage
const initialMemory = lua.totalMemory();
console.log(`Initial VM Memory: ${initialMemory} bytes`);

// 2. Allocate data in Lua state
lua.eval(`
  largeTable = {}
  for i = 1, 10000 do
    largeTable[i] = "Entry number " .. i
  end
`);

const memoryAfterAlloc = lua.totalMemory();
console.log(`Memory after allocating 10,000 strings: ${memoryAfterAlloc} bytes`);
console.log(`Allocated: ${memoryAfterAlloc - initialMemory} bytes`);

// 3. Inspect GC metrics
const metricsBefore = lua.gcMetrics();
console.log("GC Metrics before collection:", metricsBefore);

// 4. Clear table reference in Lua and trigger manual GC
lua.eval("largeTable = nil");
lua.gcCollect();

const memoryAfterGc = lua.totalMemory();
console.log(`Memory after gcCollect(): ${memoryAfterGc} bytes`);
console.log(`Freed: ${memoryAfterAlloc - memoryAfterGc} bytes`);

const metricsAfter = lua.gcMetrics();
console.log("GC Metrics after collection:", metricsAfter);
