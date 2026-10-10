import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining & Invoking Lua Functions from TS ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Defining Global Lua Functions
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Defining Global Functions in Lua ---");

  // Define a Lua function using `lua.eval()`
  lua.eval(`
    function add(a, b)
      return a + b
    end

    function greet(name)
      return "Hello, " .. name .. "!"
    end
  `);

  // Invoke the Lua functions via `lua.eval()`
  const sum = lua.eval("return add(15, 27)");
  const greeting = lua.eval("return greet('TypeScript')");

  console.log("Result of add(15, 27) in Lua:    ", sum);
  console.log("Result of greet('TypeScript'):  ", greeting);

  // ---------------------------------------------------------------------------
  // 2. Passing Arguments from Global Variables
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Invoking Functions with Global Variables ---");

  // Set TS variables as globals in Lua environment
  lua.setGlobal("numA", 100);
  lua.setGlobal("numB", 250);

  const total = lua.eval("return add(numA, numB)");
  console.log("Result of add(numA, numB) from JS globals:", total);

  // ---------------------------------------------------------------------------
  // 3. Inspecting Lua Function References in TS via NAPI
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Function References in JS/TS ---");

  // When retrieving a Lua function value via `getGlobal` or `eval`,
  // NAPI surfaces it as the placeholder string `"[lua function]"`.
  const addFnRef = lua.getGlobal("add");
  const printFnRef = lua.getGlobal("print");

  console.log("getGlobal('add') returned:  ", addFnRef);
  console.log("getGlobal('print') returned:", printFnRef);

  // ---------------------------------------------------------------------------
  // 4. Higher-Order Functions & Anonymous Functions
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Anonymous & Higher-Order Functions ---");

  lua.eval(`
    function applyOperation(arr, fn)
      local result = {}
      for i, val in ipairs(arr) do
        table.insert(result, fn(val))
      end
      return result
    end
  `);

  lua.setGlobal("numbers", [1, 2, 3, 4, 5]);

  const doubled = lua.eval(`
    return applyOperation(numbers, function(x)
      return x * 2
    end)
  `);

  console.log("Doubled array using higher-order Lua function:", doubled);

  console.log("\n=== Demo Complete ===");
}

main();
