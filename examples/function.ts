import { Lua } from "../dist/index.js";

// Initialize a full Lua instance
const lua = Lua.full();

console.log("=== Working with Functions in @alloy-ts/lua ===");

// 1. Defining a Lua function using `eval`
lua.eval(`
  function add(a, b)
    return a + b
  end

  function greet(name)
    return "Hello, " .. name .. "!"
  end
`);

// Call Lua functions using `eval`
const sum = lua.eval("return add(10, 20)");
console.log("10 + 20 =", sum); // 30

const greeting = lua.eval("return greet('Developer')");
console.log("Greeting:", greeting); // "Hello, Developer!"

// 2. Defining anonymous functions and assigning them to globals via eval
lua.eval("multiply = function(a, b) return a * b end");
lua.setGlobal("factor", 5);
const product = lua.eval("return multiply(factor, 6)");
console.log("5 * 6 =", product); // 30

// 3. Inspecting Lua functions from JS
const addFunc = lua.getGlobal("add");
console.log("Reading a Lua function from JS returns placeholder:", addFunc); // "[lua function]"

// Note on JS functions in setGlobal:
// Currently, passing a native JavaScript function to setGlobal is not supported;
// JS functions fall through to `nil` in Lua because host JS callbacks are unexposed.
lua.setGlobal("jsFn", () => 42);
const jsFnCheck = lua.eval("return type(jsFn)");
console.log("Passing a JS function to setGlobal results in type:", jsFnCheck); // "nil"
