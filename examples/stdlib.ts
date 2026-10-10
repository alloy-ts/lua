import { Lua } from "../src/main.ts";

/**
 * Demo: Standard Library Sandboxing and Incremental Loading (`examples/stdlib.ts`).
 *
 * Constructors & Methods:
 * - `Lua.empty()`: Instantiates a bare Lua VM with no standard libraries.
 * - `Lua.core()`: Instantiates a Lua VM with core standard libraries (base, coroutine, math, string, table).
 * - `Lua.full()`: Instantiates a Lua VM with full standard libraries.
 * - `lua.loadCore()`: Loads core standard libraries into an existing instance.
 * - `lua.loadIo()`: Loads I/O standard libraries into an existing instance.
 */

export function runStdlibDemo() {
  console.log("=== 1. Empty VM (Sandboxed) ===");
  const emptyLua = Lua.empty();
  // Math expressions work in empty VM, but standard library functions (like `type`) do not
  const mathExpr = emptyLua.eval("return 1 + 2 * 3");
  console.log("Empty VM math eval (1 + 2 * 3):", mathExpr);

  let typeErrorOccurred = false;
  try {
    emptyLua.eval("return type(123)");
  } catch {
    typeErrorOccurred = true;
  }
  console.log(`Empty VM lacks 'type()' base library function: ${typeErrorOccurred}`);

  console.log("\n=== 2. Loading Core Libraries ===");
  emptyLua.loadCore();
  const typeVal = emptyLua.eval("return type(123)");
  const stringUpper = emptyLua.eval("return string.upper('hello')");
  console.log("Core VM 'type(123)':", typeVal);
  console.log("Core VM 'string.upper(\"hello\")':", stringUpper);

  console.log("\n=== 3. Core VM vs Full VM ===");
  const coreLua = Lua.core();
  const fullLua = Lua.full();

  const coreMath = coreLua.eval("return math.sqrt(16)");
  const fullMath = fullLua.eval("return math.sqrt(16)");

  console.log(`coreLua math.sqrt(16): ${coreMath}`);
  console.log(`fullLua math.sqrt(16): ${fullMath}`);

  return {
    mathExpr,
    typeErrorOccurred,
    typeVal,
    stringUpper,
    coreMath,
    fullMath,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdlibDemo();
}
