import { Lua } from "../src/main.ts";

/**
 * Demo: Defining and invoking Lua functions from TypeScript using NAPI.
 *
 * Question: How can we define Lua functions from TS/JS via NAPI?
 * Answer:
 * 1. Defining Functions: Functions are defined in the Lua VM by evaluating Lua code declarations
 *    via `lua.eval("function name(a, b) return a + b end")` or setting anonymous functions.
 * 2. Invoking Functions: Functions defined in Lua can be invoked from TS/JS by evaluating call
 *    expressions via `lua.eval("return name(arg1, arg2)")`.
 * 3. NAPI Value Mapping: In this binding layer, reading a Lua function reference via `lua.getGlobal("name")`
 *    returns `"[lua function]"`. Passing JS function references directly across NAPI converts them to `nil`.
 *    Function logic is executed inside the Lua VM engine by evaluating script blocks.
 */

export function runFunctionDemo() {
  const lua = Lua.full();

  console.log("=== 1. Defining Global Lua Functions ===");

  // Define a simple math function in Lua
  lua.eval(`
    function multiply(a, b)
      return a * b
    end
  `);

  // Invoke the Lua function from TS with arguments
  const product = lua.eval("return multiply(6, 7)");
  console.log(`multiply(6, 7) = ${product}`); // 42

  // Inspect function reference in TS
  const funcRef = lua.getGlobal("multiply");
  console.log(`getGlobal("multiply"): ${funcRef}`); // "[lua function]"

  console.log("\n=== 2. Multiple Return Values & Closures ===");

  // Lua functions can return multiple values (pack into array or table for TS)
  lua.eval(`
    function minMax(a, b, c)
      local minVal = math.min(a, b, c)
      local maxVal = math.max(a, b, c)
      return { min = minVal, max = maxVal }
    end
  `);

  const bounds = lua.eval("return minMax(15, 3, 42)");
  console.log("minMax(15, 3, 42) result:", bounds);

  // Defining closures and factory functions in Lua
  lua.eval(`
    function makeCounter(start)
      local count = start or 0
      return function()
        count = count + 1
        return count
      end
    end

    counter1 = makeCounter(10)
  `);

  console.log("counter1() call 1:", lua.eval("return counter1()")); // 11
  console.log("counter1() call 2:", lua.eval("return counter1()")); // 12

  console.log("\n=== 3. Higher-Order Functions & Callbacks in Lua ===");

  // Pass functions as parameters inside Lua
  lua.eval(`
    function mapArray(arr, fn)
      local result = {}
      for i, v in ipairs(arr) do
        table.insert(result, fn(v))
      end
      return result
    end

    function double(x) return x * 2 end
  `);

  // Pass array from TS, apply double function in Lua
  lua.setGlobal("numbers", [1, 2, 3, 4, 5]);
  const doubled = lua.eval("return mapArray(numbers, double)");
  console.log("mapArray([1, 2, 3, 4, 5], double) =", doubled);

  return {
    product,
    funcRef,
    bounds,
    doubled,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFunctionDemo();
}
