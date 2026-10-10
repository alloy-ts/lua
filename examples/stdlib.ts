import { Lua } from "../src/main.ts";

export function runStdlibExample() {
  console.log("=== Standard Library Sandboxing & Incremental Loading ===");

  // 1. Lua.empty(): Completely isolated sandboxed instance without stdlib
  console.log("\n1. Lua.empty()");
  const emptyLua = Lua.empty();
  console.log("Arithmetic expression (no stdlib required):", emptyLua.eval("return 20 + 22"));

  try {
    emptyLua.eval("return string.upper('hello')");
  } catch (err) {
    console.log("Attempting string.upper in empty instance failed as expected:", (err as Error).message);
  }

  // 2. Incremental stdlib loading: loadCore()
  console.log("\n2. Incremental loading via loadCore()");
  emptyLua.loadCore();
  console.log("string.upper after loadCore():", emptyLua.eval("return string.upper('hello')"));
  console.log("math.floor after loadCore():", emptyLua.eval("return math.floor(7.99)"));

  // 3. Lua.core(): Instantiates VM with core libraries pre-loaded
  console.log("\n3. Lua.core()");
  const coreLua = Lua.core();
  console.log("table.concat in core instance:", coreLua.eval("return table.concat({'a', 'b', 'c'}, '-')"));

  // 4. Lua.full(): Full instance
  console.log("\n4. Lua.full()");
  const fullLua = Lua.full();
  console.log("math.pi in full instance:", fullLua.eval("return math.pi"));
  console.log("coroutine.status in full instance:", fullLua.eval("return coroutine.status(coroutine.create(function() end))"));
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runStdlibExample();
}
