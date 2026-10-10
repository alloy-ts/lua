import { Lua } from "../index.js";

const lua = new Lua();

console.log("=== Demo: Memory Monitoring & Garbage Collection Controls in Lua ===\n");

// 1. Check initial memory usage
console.log("Initial total memory (bytes):", lua.totalMemory());
console.log("Initial GC metrics:", lua.gcMetrics());

// 2. Allocate data inside Lua
lua.eval(`
  largeTable = {}
  for i = 1, 10000 do
    largeTable[i] = "item_" .. i
  end
`);

console.log("\nMemory after allocating large table (bytes):", lua.totalMemory());
console.log("GC metrics after allocation:", lua.gcMetrics());

// 3. Clear data and trigger garbage collection
lua.eval("largeTable = nil");

console.log("\nTriggering explicit GC collection (lua.gcCollect())...");
lua.gcCollect();

console.log("Memory after GC collect (bytes):", lua.totalMemory());
console.log("GC metrics after GC collect:", lua.gcMetrics());
