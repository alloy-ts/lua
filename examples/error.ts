import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("=== Scenario 1: Catching Lua Runtime Errors in JS ===");
// When Lua code calls `error(...)` or performs an invalid operation (e.g. indexing nil),
// `lua.eval(...)` throws a JavaScript `Error` that can be caught with try/catch.
try {
  lua.eval("error('Something went wrong inside Lua!')");
} catch (err) {
  if (err instanceof Error) {
    console.log("Caught Lua runtime error in JS:", err.message);
  }
}

try {
  // Attempting to index a nil global
  lua.eval("return nonExistentTable.field");
} catch (err) {
  if (err instanceof Error) {
    console.log("Caught nil indexing error in JS:", err.message);
  }
}

console.log("\n=== Scenario 2: Catching Lua Compile/Syntax Errors in JS ===");
// Invalid syntax throws a compilation Error in JS.
try {
  lua.eval("function unclosed(");
} catch (err) {
  if (err instanceof Error) {
    console.log("Caught Lua syntax error in JS:", err.message);
  }
}

console.log("\n=== Scenario 3: JS Callback Error Propagating Back to JS ===");
// Register a callback that throws a JS exception.
lua.register("throwInJs", () => {
  throw new Error("Database connection failed!");
});

// When Lua invokes the callback directly (without pcall), the JS exception converts
// into a Lua error, which then propagates back out of `lua.eval` as a JS Error!
try {
  lua.eval("throwInJs()");
} catch (err) {
  if (err instanceof Error) {
    console.log("Caught callback exception back in JS:", err.message);
  }
}

console.log("\n=== Scenario 4: JS Callback Error Caught Inside Lua via pcall ===");
// If Lua wraps the call in `pcall(func, ...)` or `xpcall(func, handler)`,
// Lua intercepts the error and returns `ok = false` and the error object!
const result = lua.eval(`
  local ok, err = pcall(throwInJs)
  if not ok then
    return {
      handledInLua = true,
      errorMessage = tostring(err)
    }
  end
  return { handledInLua = false }
`) as { handledInLua: boolean; errorMessage: string };

console.log("Lua pcall result:", result);
