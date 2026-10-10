import { Lua } from "../src/main.ts";

const lua = new Lua();

console.log("=== Lua Functions & Closures ===");

// 1. Defining a Lua function from TS via Lua code evaluation
lua.eval(`
  function add(a, b)
    return a + b
  end

  function multiply(a, b)
    return a * b
  end
`);

console.log("add(5, 10):", lua.eval("return add(5, 10)"));
console.log("multiply(3, 7):", lua.eval("return multiply(3, 7)"));

// 2. Defining a Higher-Order Function (Function taking another function)
lua.eval(`
  function applyOperation(op, a, b)
    return op(a, b)
  end
`);

console.log("applyOperation(add, 20, 30):", lua.eval("return applyOperation(add, 20, 30)"));
console.log("applyOperation(multiply, 4, 5):", lua.eval("return applyOperation(multiply, 4, 5)"));

// 3. Defining Closures (Function returning a function with state)
lua.eval(`
  function makeCounter(start)
    local count = start or 0
    return function()
      count = count + 1
      return count
    end
  end

  counter1 = makeCounter(0)
  counter2 = makeCounter(10)
`);

console.log("counter1():", lua.eval("return counter1()")); // 1
console.log("counter1():", lua.eval("return counter1()")); // 2
console.log("counter2():", lua.eval("return counter2()")); // 11
console.log("counter1():", lua.eval("return counter1()")); // 3
