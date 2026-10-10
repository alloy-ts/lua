import { Lua } from "../src/main.ts";

// Create a full Lua instance
const lua = Lua.full();

// 1. Registering a JS function callable from Lua using registerCallback
lua.registerCallback("add", (a: number, b: number) => {
  console.log(`[JS Callback] add called with: ${a}, ${b}`);
  return a + b;
});

lua.registerCallback("greet", (name: string) => {
  return `Hello, ${name} from JavaScript!`;
});

// Call the registered JS callbacks from Lua script
console.log("--- Calling registered JS callbacks from Lua ---");
const addResult = lua.eval("return add(15, 27)");
console.log("Result from add(15, 27):", addResult);

const greetResult = lua.eval("return greet('Lua User')");
console.log("Result from greet('Lua User'):", greetResult);

// 2. Defining global variables and using functions in Lua
console.log("\n--- Passing values and executing Lua functions ---");
lua.setGlobal("multiplier", 3);
const calcResult = lua.eval(`
  local function square(x)
    return x * x
  end
  return square(5) * multiplier
`);
console.log("Result of square(5) * multiplier:", calcResult);
