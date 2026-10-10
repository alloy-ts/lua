import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining and Invoking Lua Functions from TS ===");
  const lua = Lua.core();

  // 1. Define a Lua function
  lua.eval(`
    function add(a, b)
      return a + b
    end

    function multiply(a, b)
      return a * b
    end

    function greet(name)
      return "Hello, " .. name .. "!"
    end
  `);

  // 2. Invoke Lua functions with arguments
  const sum = lua.eval("return add(15, 27)");
  console.log("add(15, 27) =>", sum);

  const product = lua.eval("return multiply(6, 7)");
  console.log("multiply(6, 7) =>", product);

  const message = lua.eval("return greet('TypeScript')");
  console.log("greet('TypeScript') =>", message);

  // 3. Higher-order function in Lua
  lua.eval(`
    function applyOperation(fn, x, y)
      return fn(x, y)
    end
  `);

  const result = lua.eval("return applyOperation(multiply, 8, 9)");
  console.log("applyOperation(multiply, 8, 9) =>", result);
}

main();
