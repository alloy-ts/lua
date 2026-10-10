import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("--- Error Handling & Exceptions Examples ---");

// 1. Catching Lua syntax / compile errors in JS via try/catch
console.log("1. Catching Lua compile errors in JS:");
try {
  lua.eval("invalid lua syntax @@@");
} catch (err: any) {
  console.log("  Caught compile error:", err.message);
}

// 2. Catching Lua runtime errors in JS via try/catch
console.log("\n2. Catching Lua runtime errors in JS:");
try {
  lua.eval("error('something went wrong in Lua!')");
} catch (err: any) {
  console.log("  Caught runtime error:", err.message);
}

// 3. Incremental Executor error handling
console.log("\n3. Executor step error handling:");
const exec = lua.executor("local a = nil; return a.property"); // Attempting field access on nil
const stepRes = exec.step(100);
console.log("  Executor step done:", stepRes.done);
console.log("  Executor step error:", stepRes.error);

// 4. JS functions registered via registerCallback throwing exceptions
console.log("\n4. JS callbacks throwing exceptions:");
lua.registerCallback("throw_js_error", () => {
  throw new Error("Disk full error from JS callback!");
});

// 4a. Lua handles the JS error using pcall
console.log("  4a. Lua catching JS callback exception using `pcall`:");
const pcallRes = lua.eval(`
  local success, err = pcall(throw_js_error)
  return { success = success, error = err }
`) as { success: boolean; error: string };
console.log("    pcall success:", pcallRes.success);
console.log("    pcall caught error message:", pcallRes.error);

// 4b. Unhandled JS callback exception bubbling up to JS try/catch
console.log("  4b. Unhandled JS callback exception bubbling up to JS try/catch:");
try {
  lua.eval("throw_js_error()");
} catch (err: any) {
  console.log("    Caught bubbled error in JS:", err.message);
}
