import { Lua } from "../src/main.ts";

/**
 * Example: Exception & Error Handling between Lua and JS/TS
 *
 * Questions addressed:
 * - What happens when an error occurs during Lua `eval()`?
 *   - NAPI converts Lua compile errors and runtime errors into standard JavaScript `Error` exceptions.
 * - Can we use `try/catch` in JS to catch Lua errors?
 *   - Yes! Any Lua compile error or runtime error thrown during `lua.eval()` is caught by standard JS `try { ... } catch (err) { ... }`.
 * - How can errors be handled inside Lua code?
 *   - Lua provides `pcall` (protected call) or `xpcall` to catch errors within Lua without bubbling them up to JS.
 */

function runErrorHandlingExample() {
  const lua = Lua.core();

  console.log("=== 1. Catching Lua Syntax / Compile Errors in JS ===");
  try {
    // Attempt to evaluate malformed Lua syntax
    lua.eval("invalid lua syntax +++ !");
  } catch (err) {
    if (err instanceof Error) {
      console.log("Caught JS Error (Lua Compile Error):");
      console.log("Message:", err.message);
    }
  }

  console.log("\n=== 2. Catching Lua Runtime Errors in JS ===");
  try {
    // Attempt an invalid runtime operation in Lua (e.g., adding string and nil, or explicit error())
    lua.eval(`
      local x = nil
      local y = 10 + x  -- Throws runtime error: attempt to perform arithmetic on a nil value
    `);
  } catch (err) {
    if (err instanceof Error) {
      console.log("Caught JS Error (Lua Runtime Error):");
      console.log("Message:", err.message);
    }
  }

  console.log("\n=== 3. Catching Explicit Lua `error()` calls in JS ===");
  try {
    lua.eval('error("Custom domain error thrown from Lua script!")');
  } catch (err) {
    if (err instanceof Error) {
      console.log("Caught JS Error (Explicit error call):");
      console.log("Message:", err.message);
    }
  }

  console.log("\n=== 4. Handling Errors within Lua using `pcall` (Protected Call) ===");
  // Lua's `pcall` executes a function in protected mode.
  // It returns boolean `success` as its first result, followed by either the return value or the error message.
  const pcallResult = lua.eval(`
    local success, result_or_err = pcall(function()
      error("Internal error caught by Lua pcall")
    end)

    return {
      ok = success,
      message = result_or_err
    }
  `) as { ok: boolean; message: string };

  console.log("Lua pcall result handled inside Lua script:");
  console.log("  Success:", pcallResult.ok);
  console.log("  Caught Message:", pcallResult.message);
  console.log("Notice that `pcall` prevents the error from throwing to JS!");
}

runErrorHandlingExample();
