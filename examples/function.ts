import { Lua } from "../src/main.ts";

/**
 * Example demonstrating how to define and invoke Lua functions using NAPI via `lua.eval(...)`.
 */
function runFunctionDemo() {
  const lua = Lua.full();

  console.log("=== 1. Defining and Calling Simple Lua Functions ===");

  // Define a Lua function
  lua.eval(`
    function add(a, b)
      return a + b
    end
  `);

  // Invoke the function and inspect return values
  console.log("add(15, 27) ->", lua.eval("return add(15, 27)"));

  console.log("\n=== 2. String Formatting & Helper Functions in Lua ===");

  lua.eval(`
    function greet(name, title)
      title = title or "Developer"
      return "Hello, " .. title .. " " .. name .. "!"
    end
  `);

  console.log(lua.eval("return greet('Alice', 'Senior')"));
  console.log(lua.eval("return greet('Bob')"));

  console.log("\n=== 3. Higher-Order Functions & Anonymous Functions ===");

  lua.eval(`
    function applyTwice(f, val)
      return f(f(val))
    end

    function double(x)
      return x * 2
    end
  `);

  console.log("applyTwice(double, 5) ->", lua.eval("return applyTwice(double, 5)"));
}

runFunctionDemo();
