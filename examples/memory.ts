import { Lua } from "../src/main.ts";

// Create a new Lua instance
const lua = Lua.full();

console.log("=== 1. Checking Memory Allocation ===");

// Check initial memory allocated by the Lua VM (in bytes)
const initialMemory = lua.totalMemory();
console.log(`Initial total memory used: ${initialMemory} bytes`);

// Fetch GC metrics
const initialMetrics = lua.gcMetrics();
console.log("Initial GC Metrics:", initialMetrics);

console.log("\n=== 2. Allocating Memory in Lua ===");

// Allocate a large table with 100,000 numbers in Lua
lua.eval(`
  largeTable = {}
  for i = 1, 100000 do
    largeTable[i] = "Data entry " .. i
  end
`);

const memoryAfterAlloc = lua.totalMemory();
console.log(`Memory after allocating large table: ${memoryAfterAlloc} bytes`);
console.log(
  `Memory increased by: ${memoryAfterAlloc - initialMemory} bytes (${((memoryAfterAlloc - initialMemory) / 1024).toFixed(2)} KB)`,
);

console.log("\n=== 3. Running Garbage Collection ===");

// Nullify table reference in Lua
lua.eval("largeTable = nil");

// Trigger explicit GC collect cycle
lua.gcCollect();

const memoryAfterGC = lua.totalMemory();
console.log(`Memory after dereferencing & gcCollect(): ${memoryAfterGC} bytes`);
console.log(`Memory freed: ${memoryAfterAlloc - memoryAfterGC} bytes`);

console.log("\nFinal GC Metrics:", lua.gcMetrics());
