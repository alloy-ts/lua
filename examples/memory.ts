import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("--- Memory Monitoring & Garbage Collection ---");

// Initial memory
const initialMem = lua.totalMemory();
console.log(`Initial memory: ${initialMem} bytes`);

// Initial GC metrics
const initialMetrics = lua.gcMetrics();
console.log("Initial GC metrics:", initialMetrics);

// Allocate some memory in Lua
console.log("\nAllocating memory in Lua environment...");
lua.eval(`
  largeTable = {}
  for i = 1, 10000 do
    largeTable[i] = "string data " .. i
  end
`);

const allocatedMem = lua.totalMemory();
console.log(`Memory after allocation: ${allocatedMem} bytes`);
console.log("Metrics after allocation:", lua.gcMetrics());

// Trigger Garbage Collection
console.log("\nClearing global table and triggering garbage collection...");
lua.setGlobal("largeTable", undefined);
lua.gcCollect();

const postGcMem = lua.totalMemory();
console.log(`Memory after gcCollect(): ${postGcMem} bytes`);
console.log("Metrics after gcCollect():", lua.gcMetrics());
