import { Lua } from "../index.js";

/**
 * Example demonstrating memory monitoring (`totalMemory()`, `gcMetrics()`) and explicit
 * garbage collection controls (`gcCollect()`) in the Lua execution environment via NAPI.
 */
export function runMemoryExample() {
  const lua = Lua.full();

  console.log("=== Part 1: Checking Initial Memory Footprint ===");

  const initialBytes = lua.totalMemory();
  console.log(
    `Initial total memory: ${initialBytes} bytes (${(initialBytes / 1024).toFixed(2)} KB)`,
  );

  const initialMetrics = lua.gcMetrics();
  console.log("Initial GC Metrics:", initialMetrics);

  console.log("\n=== Part 2: Allocating Lua Data to Increase Memory ===");

  // Create temporary tables to consume memory
  lua.eval(`
    largeBuffer = {}
    for i = 1, 30000 do
      largeBuffer[i] = "Data record #" .. i
    end
  `);

  const bytesAfterAlloc = lua.totalMemory();
  console.log(
    `Memory after allocation: ${bytesAfterAlloc} bytes (${(bytesAfterAlloc / 1024).toFixed(2)} KB)`,
  );
  console.log(`Growth: +${((bytesAfterAlloc - initialBytes) / 1024).toFixed(2)} KB`);

  console.log("\n=== Part 3: Releasing References and Collecting Garbage ===");

  // Clear reference to allow GC
  lua.eval("largeBuffer = nil");

  // Run full garbage collection cycle
  lua.gcCollect();

  const bytesAfterGc = lua.totalMemory();
  console.log(
    `Memory after gcCollect(): ${bytesAfterGc} bytes (${(bytesAfterGc / 1024).toFixed(2)} KB)`,
  );

  const finalMetrics = lua.gcMetrics();
  console.log("\n=== Part 4: Final Allocator Metrics ===");
  console.log("Total Allocation:", finalMetrics.totalAllocation);
  console.log("Allocation Debt:", finalMetrics.allocationDebt);
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runMemoryExample();
}
