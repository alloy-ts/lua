import { Lua } from "../index.js";

const lua = new Lua();

console.log("=== Demo: Error Handling & Exception Propagation across JS/Lua Boundary ===\n");

// ------------------------------------------------------------------
// 1. Errors originating in Lua caught by JavaScript try/catch
// ------------------------------------------------------------------
console.log("--- 1. Catching Lua Syntax & Runtime Errors in JS ---");

try {
  // Syntax error in Lua code
  lua.eval("invalid lua syntax +");
} catch (e: any) {
  console.log("Caught Lua syntax error in JS try/catch:", e.message);
}

try {
  // Runtime error inside Lua script
  lua.eval("error('Explicit runtime error raised from Lua!')");
} catch (e: any) {
  console.log("Caught Lua runtime error in JS try/catch:", e.message);
}

// ------------------------------------------------------------------
// 2. Exception thrown from registered JS host function into Lua
// ------------------------------------------------------------------
console.log("\n--- 2. JS Exception in Host Callback Propagated through Lua ---");

// Register a JS function that throws a JavaScript error
lua.registerCallback("failingHostFunction", (val: number) => {
  if (val < 0) {
    throw new Error("Invalid negative input value in JS callback!");
  }
  return val * 2;
});

// Normal call succeeds
console.log("failingHostFunction(10) =", lua.eval("return failingHostFunction(10)"));

// Call with invalid argument causing JS function to throw
try {
  lua.eval("return failingHostFunction(-5)");
} catch (e: any) {
  console.log("Caught propagated JS error in host try/catch:", e.message);
}

// ------------------------------------------------------------------
// 3. Lua pcall (protected call) catching errors internally
// ------------------------------------------------------------------
console.log("\n--- 3. Lua Handling Errors Internally with pcall ---");

const pcallResult = lua.eval(`
  local status, err = pcall(function()
    error("Internal Lua error handled by pcall")
  end)
  return { success = status, errorMsg = err }
`) as { success: boolean; errorMsg: string };

console.log("Lua pcall result in JS:", pcallResult);
