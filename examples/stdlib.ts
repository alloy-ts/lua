import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Standard Library Sandboxing & Loading ===");

  // ---------------------------------------------------------------------------
  // 1. Lua.empty(): Strict Sandboxing
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Lua.empty() ---");

  const luaEmpty = Lua.empty();

  // Basic expressions work without stdlib
  console.log("1 + 2 in Lua.empty():", luaEmpty.eval("return 1 + 2"));

  // Base library functions (like `type` or `print`) are unavailable in an empty state
  try {
    luaEmpty.eval("return type('hello')");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log("Base library 'type' is unavailable as expected:", err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Lua.core(): Core Standard Libraries (base, math, string, table, coroutine)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Lua.core() ---");

  const luaCore = Lua.core();

  console.log("type('hello') in Lua.core():       ", luaCore.eval("return type('hello')"));
  console.log("string.upper('hello') in Lua.core():", luaCore.eval("return string.upper('hello')"));
  console.log("math.floor(3.14) in Lua.core():     ", luaCore.eval("return math.floor(3.14)"));

  // I/O library is omitted in `Lua.core()` for security
  console.log("Is 'io' library available in Lua.core()?:", luaCore.eval("return io ~= nil"));

  // ---------------------------------------------------------------------------
  // 3. Lua.full(): Full Standard Library
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Lua.full() ---");

  const luaFull = Lua.full();

  console.log("Is 'io' library available in Lua.full()?:", luaFull.eval("return io ~= nil"));

  // ---------------------------------------------------------------------------
  // 4. Incremental Library Loading (`loadCore()`, `loadIo()`)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Dynamic Stdlib Loading ---");

  const luaIncremental = Lua.empty();

  console.log("Before loadCore() - string available?:", luaIncremental.eval("return string ~= nil"));

  // Dynamically load core stdlib
  luaIncremental.loadCore();
  console.log("After loadCore()  - string available?:", luaIncremental.eval("return string ~= nil"));
  console.log("After loadCore()  - io available?:    ", luaIncremental.eval("return io ~= nil"));

  // Dynamically load I/O stdlib
  luaIncremental.loadIo();
  console.log("After loadIo()    - io available?:    ", luaIncremental.eval("return io ~= nil"));

  console.log("\n=== Demo Complete ===");
}

main();
