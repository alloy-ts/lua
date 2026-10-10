import { Lua } from "../index.js";

const lua = new Lua();

console.log("=== Demo: Defining and Calling Lua Functions from TS/JS using NAPI ===\n");

// 1. Defining a Lua function from TS by evaluating a function declaration script
lua.eval(`
  function calculateTotal(items)
    local total = 0
    for _, item in ipairs(items) do
      total = total + item.price * item.quantity
    end
    return total
  end
`);

// 2. Passing TS data to the Lua function and receiving the result back
const cartItems = [
  { price: 10, quantity: 2 },
  { price: 25, quantity: 1 },
  { price: 5, quantity: 4 },
];

lua.setGlobal("cart", cartItems);

const totalCost = lua.eval("return calculateTotal(cart)");
console.log("Cart Total calculated by Lua function:", totalCost);

// 3. Defining anonymous closure functions and higher-order functions in Lua
lua.eval(`
  function makeMultiplier(factor)
    return function(n)
      return n * factor
    end
  end

  double = makeMultiplier(2)
  triple = makeMultiplier(3)
`);

console.log("Calling double(21) in Lua:", lua.eval("return double(21)"));
console.log("Calling triple(14) in Lua:", lua.eval("return triple(14)"));
