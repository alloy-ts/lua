import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Memory Monitoring & Garbage Collection ===");
  const lua = Lua.core();

  console.log("Initial total memory (bytes):", lua.totalMemory());
  console.log("Initial GC metrics:", lua.gcMetrics());

  // Allocate data in Lua environment
  lua.eval(`
    largeTable = {}
    for i = 1, 10000 do
      largeTable[i] = "memory allocation test string " .. tostring(i)
    end
  `);

  console.log("\nAfter allocation - Total memory (bytes):", lua.totalMemory());
  console.log("After allocation - GC metrics:", lua.gcMetrics());

  // Clear reference and trigger manual garbage collection
  lua.eval("largeTable = nil");
  lua.gcCollect();

  console.log("\nAfter GC - Total memory (bytes):", lua.totalMemory());
  console.log("After GC - GC metrics:", lua.gcMetrics());
}

main();
