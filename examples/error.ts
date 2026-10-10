import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("=== 1. Lua Syntax Error caught in JS try/catch ===");
try {
  lua.eval("invalid lua syntax %$%@#");
} catch (err) {
  console.log("Caught Lua compile error in JS:", (err as Error).message);
}

console.log("\n=== 2. Lua Runtime Error caught in JS try/catch ===");
try {
  lua.eval("error('Lua runtime exception!')");
} catch (err) {
  console.log("Caught Lua runtime error in JS:", (err as Error).message);
}

console.log("\n=== 3. JS Function Exception caught inside Lua using pcall ===");
lua.setGlobal("buggyJsFunction", () => {
  throw new Error("JS function failed intentionally!");
});

const pcallResult = lua.eval(`
  local ok, err = pcall(buggyJsFunction)
  return {
    success = ok,
    errorMessage = tostring(err)
  }
`);
console.log("Result of pcall(buggyJsFunction) inside Lua:", pcallResult);

console.log("\n=== 4. Uncaught JS Function Exception propagating back to JS ===");
try {
  lua.eval("buggyJsFunction()");
} catch (err) {
  console.log("Uncaught JS callback error caught in JS try/catch:", (err as Error).message);
}
