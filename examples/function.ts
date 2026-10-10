import { Lua } from "../src/main.ts";

/**
 * Example: Defining and invoking Lua functions from TypeScript/JavaScript via NAPI.
 *
 * Question: How can we define Lua functions from TS/JS via NAPI?
 * Answer:
 * - Functions are defined inside Lua VM by evaluating function statements via `lua.eval()`.
 * - Functions defined globally in Lua VM can be invoked by evaluating function calls in `lua.eval()`.
 * - Inputs can be bound as global variables via `lua.setGlobal(name, value)` before invoking the function.
 * - In NAPI, reading a Lua function value directly into JS returns the placeholder string `"[lua function]"`.
 */
function runFunctionExample() {
  console.log("=== Lua Function Definition & Invocation Example ===\n");

  const lua = Lua.full();

  // 1. Defining a global Lua function using lua.eval()
  lua.eval(`
    function greet(name)
      return "Hello, " .. name .. " from Lua!"
    end
  `);

  // 2. Inspecting the function reference in TypeScript
  const functionRef = lua.getGlobal("greet");
  console.log("Retrieved 'greet' global from JS:", functionRef);
  // Output: "[lua function]" (Lua function values are surfaced as a placeholder string in JS)

  // 3. Invoking the Lua function from TS by passing parameters via globals or arguments
  lua.setGlobal("userName", "World");
  const greeting = lua.eval("return greet(userName)");
  console.log("Result of greet(userName):", greeting); // "Hello, World from Lua!"

  // 4. Defining functions with multiple parameters and return values
  lua.eval(`
    function calculateStats(a, b, c)
      local sum = a + b + c
      local average = sum / 3
      return { sum = sum, average = average }
    end
  `);

  lua.setGlobal("valA", 10);
  lua.setGlobal("valB", 20);
  lua.setGlobal("valC", 30);

  const stats = lua.eval("return calculateStats(valA, valB, valC)");
  console.log("Result of calculateStats(10, 20, 30):", stats);
  // Output: { sum: 60, average: 20 }

  // 5. Higher-order functions and closures in Lua
  lua.eval(`
    function createMultiplier(factor)
      return function(x)
        return x * factor
      end
    end

    double = createMultiplier(2)
    triple = createMultiplier(3)
  `);

  console.log("double(21) in Lua:", lua.eval("return double(21)")); // 42
  console.log("triple(14) in Lua:", lua.eval("return triple(14)")); // 42
}

runFunctionExample();
