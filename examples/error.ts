import { Lua } from "../dist/index.js";

console.log("=== Error Handling & Exceptions in @alloy-ts/lua ===");

const lua = Lua.full();

// 1. Catching Lua Syntax / Compile Errors in JS using try/catch
console.log("\n--- 1. Syntax / Compilation Errors ---");
try {
  lua.eval("this is invalid lua syntax @@@");
} catch (err) {
  console.log("Caught compile error in JS try/catch:");
  console.log("Message:", (err as Error).message);
}

// 2. Catching Lua Runtime Errors in JS using try/catch
console.log("\n--- 2. Runtime Errors ---");
try {
  // Trigger a runtime error explicitly or via nil call
  lua.eval("error('something went wrong in Lua!')");
} catch (err) {
  console.log("Caught runtime error in JS try/catch:");
  console.log("Message:", (err as Error).message);
}

try {
  // Calling a non-existent function in Lua
  lua.eval("nonExistentFunction()");
} catch (err) {
  console.log("Caught bad call error in JS try/catch:");
  console.log("Message:", (err as Error).message);
}

// 3. Protected Calls inside Lua using `pcall`
console.log("\n--- 3. Handling Errors inside Lua via pcall ---");
const pcallResult = lua.eval(`
  local success, result = pcall(function()
    error("error caught internally by Lua pcall")
  end)

  return { success = success, error_message = tostring(result) }
`);

console.log("Lua pcall result handled inside Lua script:", pcallResult);

// 4. Handling exceptions thrown from JS functions registered in Lua
console.log("\n--- 4. Exceptions in Registered JS Functions ---");
lua.globals().set("failingJsFunction", () => {
  throw new Error("Exception thrown inside JavaScript callback!");
});

try {
  lua.eval("failingJsFunction()");
} catch (err) {
  console.log("Caught JS callback exception translated to Lua error:");
  console.log("Message:", (err as Error).message);
}
