import { Lua } from "../src/main.ts";

// Create a new Lua instance with full standard library
const lua = Lua.full();

console.log("=== 1. Defining Global Lua Functions from TS ===");

// Define a function in Lua via script evaluation
lua.eval(`
  function add(a, b)
    return a + b
  end
`);

// Set argument variables from TS and call the function in Lua
lua.setGlobal("x", 15);
lua.setGlobal("y", 27);

const sumResult = lua.eval("return add(x, y)");
console.log("Result of add(15, 27) in Lua:", sumResult);

console.log("\n=== 2. Function Expressions and Closures ===");

// Define a function expression with higher-order functions / closures
lua.eval(`
  makeMultiplier = function(factor)
    return function(number)
      return number * factor
    end
  end

  double = makeMultiplier(2)
  triple = makeMultiplier(3)
`);

lua.setGlobal("val", 10);
console.log("double(10) in Lua:", lua.eval("return double(val)"));
console.log("triple(10) in Lua:", lua.eval("return triple(val)"));

console.log("\n=== 3. Functions with Table / Object Arguments ===");

// Pass a complex TS object into Lua global, then execute a Lua processing function
lua.eval(`
  function calculateTotal(order)
    local total = 0
    for i, item in ipairs(order.items) do
      total = total + (item.price * item.quantity)
    end
    if order.discount then
      total = total * (1 - order.discount)
    end
    return total
  end
`);

const orderData = {
  discount: 0.1, // 10% discount
  items: [
    { name: "Widget A", price: 20, quantity: 2 },
    { name: "Widget B", price: 50, quantity: 1 },
  ],
};

lua.setGlobal("currentOrder", orderData);
const orderTotal = lua.eval("return calculateTotal(currentOrder)");
console.log("Calculated order total in Lua:", orderTotal);

console.log("\n=== 4. Inspecting Lua Function References in TS ===");

// Retrieving a Lua function in TS yields a placeholder string representation
console.log("Lua function reference in TS:", lua.getGlobal("add"));
