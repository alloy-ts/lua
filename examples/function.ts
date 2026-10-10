import { Lua } from "../src/main.ts";

// Initialize a Lua VM instance with standard library loaded
const lua = Lua.full();

console.log("=== Demo: Defining Lua Functions from TS/JS ===");

// 1. Defining a Global Lua Function via lua.eval()
// In the current NAPI bridge, Lua functions are defined in the Lua VM using code strings/chunks.
// Once defined, global functions become part of the Lua environment.

lua.eval(`
  function add(a, b)
    return a + b
  end

  function greet(name, title)
    title = title or "Friend"
    return "Hello " .. title .. " " .. name .. "!"
  end
`);

// Check function representation when fetched via getGlobal or returned from eval
console.log("Fetching global 'add' function:", lua.getGlobal("add")); // Output: "[lua function]"

// Invoking defined Lua functions with arguments from TS/JS using lua.eval()
const addResult = lua.eval("return add(15, 27)");
console.log("add(15, 27) =", addResult);

const greetResult = lua.eval("return greet('Alice', 'Dr.')");
console.log("greet('Alice', 'Dr.') =", greetResult);

console.log("\n=== Demo: Higher-Order Functions, Callbacks, and Closures in Lua ===");

// 2. Defining functions with closures (stateful functions) in Lua
lua.eval(`
  function createCounter(start)
    local count = start or 0
    return function()
      count = count + 1
      return count
    end
  end

  counter1 = createCounter(10)
`);

console.log("counter1() call 1:", lua.eval("return counter1()")); // 11
console.log("counter1() call 2:", lua.eval("return counter1()")); // 12
console.log("counter1() call 3:", lua.eval("return counter1()")); // 13

// 3. Higher-order function taking a mapper function in Lua
lua.eval(`
  function map(array, fn)
    local new_array = {}
    for i, v in ipairs(array) do
      new_array[i] = fn(v)
    end
    return new_array
  end
`);

// Define input array from JS
lua.setGlobal("numbers", [1, 2, 3, 4, 5]);

// Pass a Lua transformation function to map()
const mappedResult = lua.eval(`
  local doubleFn = function(x) return x * 2 end
  return map(numbers, doubleFn)
`);

console.log("Doubled numbers via Lua map():", mappedResult);

console.log("\n=== Explanation: NAPI Interoperability for Functions ===");
console.log(`
1. Function Definition:
   Lua functions are compiled and executed inside the Lua VM context via lua.eval().
   They can be stored in global variables (e.g. 'add') or table fields.

2. Function Inspection:
   When a Lua function reference is inspected via lua.getGlobal() or lua.eval(),
   NAPI surfaces it as the placeholder string "[lua function]".

3. Invocation:
   To call a Lua function with dynamic JS parameters, set global variables for parameters
   with lua.setGlobal() and invoke the function via lua.eval(), or construct function call expressions.
`);
