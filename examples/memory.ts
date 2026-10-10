import { Lua } from "../src/main.ts";

const lua = new Lua();

console.log("=== Memory Monitoring & GC Controls ===");

console.log("Initial total memory (bytes):", lua.totalMemory());

const initialMetrics = lua.gcMetrics();
console.log("Initial GC Metrics:", initialMetrics);

// Allocate some memory in Lua
lua.eval(`
  local t = {}
  for i = 1, 10000 do
    t[i] = "string_" .. i
  end
  allocated_table = t
`);

console.log("Memory after allocation (bytes):", lua.totalMemory());
console.log("GC Metrics after allocation:", lua.gcMetrics());

// Trigger garbage collection
lua.eval("allocated_table = nil");
lua.gcCollect();

console.log("Memory after gcCollect() (bytes):", lua.totalMemory());
console.log("GC Metrics after gcCollect():", lua.gcMetrics());
