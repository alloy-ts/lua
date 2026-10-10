import { Lua } from "../index.js";

// Initialize a Lua 5.4 VM instance
const lua = Lua.full();
const globals = lua.globals();

console.log("==================================================");
console.log("1. Defining Global Lua Functions from TS/JS");
console.log("==================================================");

// Define global functions in Lua using eval
lua.eval(`
  function add(a, b)
    return a + b
  end

  function multiply(a, b)
    return a * b
  end

  function greet(name, title)
    title = title or "Friend"
    return string.format("Hello, %s %s!", title, name)
  end
`);

// Invoke global Lua functions from TS by setting argument globals or evaluating function call expressions
globals.set("arg1", 15);
globals.set("arg2", 27);
const sumResult = lua.eval("return add(arg1, arg2)");
console.log("add(15, 27) result in Lua:", sumResult);

globals.set("userName", "Alice");
globals.set("userTitle", "Dr.");
const greeting = lua.eval("return greet(userName, userTitle)");
console.log("greet('Alice', 'Dr.') result in Lua:", greeting);

console.log("\n==================================================");
console.log("2. Functions Operating on Objects and Tables");
console.log("==================================================");

lua.eval(`
  function processCart(cart)
    local total = 0
    for _, item in ipairs(cart.items) do
      total = total + (item.price * item.quantity)
    end
    return {
      user = cart.user,
      total = total,
      itemCount = #cart.items
    }
  end
`);

globals.set("cartData", {
  user: "Bob",
  items: [
    { name: "Laptop", price: 999.99, quantity: 1 },
    { name: "Mouse", price: 25.50, quantity: 2 },
  ],
});

const cartSummary = lua.eval("return processCart(cartData)");
console.log("Cart summary processed by Lua function:", cartSummary);

console.log("\n==================================================");
console.log("3. Anonymous Functions and Closures in Lua");
console.log("==================================================");

// Defining a higher-order closure function in Lua
lua.eval(`
  function makeMultiplier(factor)
    return function(x)
      return x * factor
    end
  end

  doubleFunc = makeMultiplier(2)
  tripleFunc = makeMultiplier(3)
`);

console.log("doubleFunc(21) in Lua:", lua.eval("return doubleFunc(21)"));
console.log("tripleFunc(21) in Lua:", lua.eval("return tripleFunc(21)"));

console.log("\n==================================================");
console.log("4. Function Error Handling");
console.log("==================================================");

lua.eval(`
  function safeDivide(a, b)
    if b == 0 then
      error("Division by zero is not allowed!")
    end
    return a / b
  end
`);

globals.set("a", 10);
globals.set("b", 0);

try {
  lua.eval("return safeDivide(a, b)");
} catch (err: any) {
  console.log("Caught Lua runtime error in TS:", err.message);
}
