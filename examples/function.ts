import { Lua } from "../index.js";

/**
 * Example demonstrating how to define, pass parameters to, and invoke Lua functions
 * from TypeScript using `lua.globals()` and `lua.eval()`.
 */
export function runFunctionExample() {
  const lua = Lua.full();
  const globals = lua.globals();

  console.log("=== Part 1: Defining and Invoking Simple Functions ===");

  // Define a Lua function
  lua.eval(`
    function add(a, b)
      return a + b
    end

    function greet(name)
      return "Hello, " .. name .. "!"
    end
  `);

  // Inspect function references
  console.log("add function reference:", globals.get("add")); // "[lua function]"

  // Invoke Lua function with arguments via eval
  console.log("add(15, 27):", lua.eval("return add(15, 27)")); // 42
  console.log("greet('TypeScript'):", lua.eval("return greet('TypeScript')")); // "Hello, TypeScript!"

  console.log("\n=== Part 2: Passing TS Variables as Function Arguments ===");

  // Set TS variables as globals to use as arguments
  globals.set("x", 100);
  globals.set("y", 250);

  const sumResult = lua.eval("return add(x, y)");
  console.log("add(x, y) with TS globals:", sumResult); // 350

  console.log("\n=== Part 3: Closures and State Retention in Lua Functions ===");

  // Higher-order function / factory closure in Lua
  lua.eval(`
    function createCounter(initial)
      local count = initial or 0
      return {
        increment = function() count = count + 1; return count end,
        get = function() return count end
      }
    end

    counter1 = createCounter(10)
  `);

  console.log("Initial count:", lua.eval("return counter1.get()")); // 10
  console.log("After increment 1:", lua.eval("return counter1.increment()")); // 11
  console.log("After increment 2:", lua.eval("return counter1.increment()")); // 12

  console.log("\n=== Part 4: Processing Complex Objects with Functions ===");

  // Function operating on complex tables
  lua.eval(`
    function processUser(u)
      return {
        displayName = u.firstName .. " " .. u.lastName,
        isAdult = u.age >= 18,
        summary = u.firstName .. " is " .. u.age .. " years old."
      }
    end
  `);

  // Pass TS object into Lua function
  globals.set("inputUser", {
    firstName: "Jane",
    lastName: "Doe",
    age: 25,
  });

  const processed = lua.eval("return processUser(inputUser)");
  console.log("Result from processUser(inputUser):", processed);
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runFunctionExample();
}
