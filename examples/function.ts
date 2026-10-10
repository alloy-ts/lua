import { Lua } from "../src/main.ts";

function main() {
  const lua = Lua.full();

  console.log("=== 1. Defining Global Lua Functions from TypeScript ===");

  // Define a mathematical helper function in Lua
  lua.eval(`
    function add(a, b)
      return a + b
    end

    function calculateTotal(items, taxRate)
      local total = 0
      for _, item in ipairs(items) do
        total = total + item.price * item.quantity
      end
      return total * (1 + taxRate)
    end
  `);

  // Invoke the Lua 'add' function with arguments
  lua.setGlobal("x", 15);
  lua.setGlobal("y", 27);
  const sum = lua.eval("return add(x, y)");
  console.log("Result of add(15, 27):", sum);

  // Pass TypeScript arrays & objects to a Lua function
  const items = [
    { name: "Laptop", price: 1000, quantity: 2 },
    { name: "Mouse", price: 50, quantity: 3 },
  ];
  lua.setGlobal("cartItems", items);
  lua.setGlobal("taxRate", 0.1);

  const grandTotal = lua.eval("return calculateTotal(cartItems, taxRate)");
  console.log("Calculated grand total with 10% tax:", grandTotal);

  console.log("\n=== 2. Creating Statefully Encapsulated Closures in Lua ===");

  // Define a counter factory closure in Lua
  lua.eval(`
    function createCounter(startVal)
      local count = startVal or 0
      return function(step)
        count = count + (step or 1)
        return count
      end
    end

    counter1 = createCounter(10)
    counter2 = createCounter(100)
  `);

  console.log("counter1 step 1:", lua.eval("return counter1(1)")); // 11
  console.log("counter1 step 5:", lua.eval("return counter1(5)")); // 16
  console.log("counter2 step 10:", lua.eval("return counter2(10)")); // 110

  console.log("\n=== 3. Recursive Functions and Multi-Return Values in Lua ===");

  // Define recursive fibonacci and multi-return functions
  lua.eval(`
    function fibonacci(n)
      if n <= 1 then return n end
      return fibonacci(n - 1) + fibonacci(n - 2)
    end

    function minMax(numbers)
      local minVal = numbers[1]
      local maxVal = numbers[1]
      for _, v in ipairs(numbers) do
        if v < minVal then minVal = v end
        if v > maxVal then maxVal = v end
      end
      return { min = minVal, max = maxVal }
    end
  `);

  console.log("Fibonacci(10):", lua.eval("return fibonacci(10)"));

  lua.setGlobal("numbersList", [42, 7, 19, 99, 3, 56]);
  const stats = lua.eval("return minMax(numbersList)");
  console.log("Min and Max result:", stats);
}

main();
