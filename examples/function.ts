import { Lua } from "../dist/index.js";

// Initialize a full Lua instance
const lua = Lua.full();

console.log("=== Working with Functions & Globals in @alloy-ts/lua ===");

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

// 2. Interacting with global variables via `lua.globals()`
const globals = lua.globals();
globals.set("factor", 5);
console.log("Read global 'factor':", globals.get("factor")); // 5

// 3. Registering JavaScript functions as callable Lua functions
globals.set("jsMultiply", (a: number, b: number) => a * b);
globals.set("jsConcat", (s1: string, s2: string) => `${s1} ${s2}`);

// Execute Lua code that invokes the registered JS functions
const product = lua.eval("return jsMultiply(factor, 6)");
console.log("Calling jsMultiply(5, 6) from Lua:", product); // 30

const text = lua.eval("return jsConcat('Hello from', 'JavaScript!')");
console.log("Calling jsConcat from Lua:", text); // "Hello from JavaScript!"

// 4. Reading Lua functions from JS
const addFunc = globals.get("add");
console.log("Reading a Lua function from JS returns placeholder:", addFunc); // "[lua function]"
