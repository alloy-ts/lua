import { Lua } from "../index.js";

// Initialize a Lua VM instance
const lua = Lua.full();

console.log("==================================================");
console.log("Lua Memory Monitoring and Garbage Collection Demo");
console.log("==================================================");

// 1. Check initial memory usage
const initialMemory = lua.totalMemory();
console.log(`Initial total memory: ${initialMemory} bytes`);

const initialMetrics = lua.gcMetrics();
console.log("Initial GC Metrics:", initialMetrics);

// 2. Allocate memory inside Lua state
console.log("\nAllocating large table inside Lua VM...");
lua.eval(`
  largeTable = {}
  for i = 1, 10000 do
    largeTable[i] = string.rep("LuaMemoryTestChunk-", 10)
  end
`);

const allocatedMemory = lua.totalMemory();
console.log(`Memory after allocation: ${allocatedMemory} bytes (+${allocatedMemory - initialMemory} bytes)`);

const allocatedMetrics = lua.gcMetrics();
console.log("GC Metrics after allocation:", allocatedMetrics);

// 3. Clear references and run manual GC
console.log("\nClearing table reference and triggering GC...");
lua.eval("largeTable = nil");

lua.gcCollect();

const postGcMemory = lua.totalMemory();
console.log(`Memory after gcCollect(): ${postGcMemory} bytes`);

const postGcMetrics = lua.gcMetrics();
console.log("GC Metrics after gcCollect():", postGcMetrics);
