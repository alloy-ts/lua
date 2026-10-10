import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("=== 1. Catching Lua Syntax & Compile Errors in JS ===");
try {
  lua.eval("this is invalid lua syntax @@@");
} catch (err: any) {
  console.log("Caught in JS try/catch:");
  console.log(`  Name: ${err.name}`);
  console.log(`  Message: ${err.message}\n`);
}

console.log("=== 2. Catching Lua Runtime Errors in JS ===");
try {
  // Calling error() in Lua or performing invalid operations
  lua.eval("error('Something went wrong inside Lua!')");
} catch (err: any) {
  console.log("Caught in JS try/catch:");
  console.log(`  Message: ${err.message}\n`);
}

console.log("=== 3. JS Callback Error -> Caught by Lua pcall ===");
lua.register("riskyHostFunc", () => {
  throw new Error("Database connection lost!");
});

// Lua uses pcall to catch the error thrown by the JS host function
const pcallResult = lua.eval(`
  local ok, err = pcall(riskyHostFunc)
  if not ok then
    return "Lua caught JS error: " .. tostring(err)
  end
  return "Success"
`);
console.log(`Lua pcall result: ${pcallResult}\n`);

console.log("=== 4. Uncaught JS Callback Error -> Propagates back to JS ===");
try {
  // Lua calls the JS callback without pcall
  lua.eval("riskyHostFunc()");
} catch (err: any) {
  console.log("Uncaught in Lua -> Propagated back to JS try/catch:");
  console.log(`  Message: ${err.message}\n`);
}
