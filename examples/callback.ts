import { Lua } from "../src/main.ts";

// Create a Lua instance
const lua = Lua.full();

// 1. Register a simple math callback
lua.register("add", (a: number, b: number) => {
  console.log(`[JS Host] 'add' callback invoked with arguments: ${a}, ${b}`);
  return a + b;
});

// 2. Register a string formatting callback
lua.register("greet", (name: string) => {
  console.log(`[JS Host] 'greet' callback invoked with name: ${name}`);
  return `Hello, ${name}! Welcome to @alloy-ts/lua.`;
});

// 3. Register a callback that throws an exception
lua.register("fetchData", (id: number) => {
  console.log(`[JS Host] 'fetchData' callback invoked with id: ${id}`);
  if (id <= 0) {
    throw new Error("Invalid ID: Must be greater than 0");
  }
  return `Data for record #${id}`;
});

console.log("=== Demo 1: Invoking JS callbacks from Lua ===");
const sum = lua.eval("return add(15, 27)");
console.log(`Result from Lua add(15, 27): ${sum}\n`);

const greeting = lua.eval("return greet('Developer')");
console.log(`Result from Lua greet('Developer'): ${greeting}\n`);

const validData = lua.eval("return fetchData(42)");
console.log(`Result from Lua fetchData(42): ${validData}\n`);

console.log("=== Demo 2: Handling JS Exceptions in Lua via pcall ===");
// Using Lua's built-in pcall to catch JS host errors
const luaScript = `
  local ok, result = pcall(fetchData, -1)
  if not ok then
    return "Handled error: " .. result
  else
    return result
  end
`;

const errorResult = lua.eval(luaScript);
console.log(`Final evaluation result: ${errorResult}\n`);
