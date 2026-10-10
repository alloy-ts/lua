import { Lua } from "../src/main.ts";

export function runErrorExample() {
  const lua = Lua.full();

  console.log("=== Error Handling & Exceptions in Lua / JS ===");

  // 1. Catching Lua Syntax / Compile Errors in JavaScript/TypeScript
  console.log("\n1. Syntax / Compile Errors:");
  try {
    lua.eval("this is invalid lua syntax @@@");
  } catch (err) {
    console.log("Caught Compile Error in JS:", (err as Error).message);
  }

  // 2. Catching Lua Runtime Errors in JavaScript/TypeScript
  console.log("\n2. Runtime Errors:");
  try {
    lua.eval('error("Custom runtime error from Lua!")');
  } catch (err) {
    console.log("Caught Runtime Error in JS:", (err as Error).message);
  }

  try {
    // Attempting to index a nil value in Lua
    lua.eval("local t = nil; return t.field");
  } catch (err) {
    console.log("Caught Nil Indexing Error in JS:", (err as Error).message);
  }

  // 3. Handling Errors inside Lua using pcall (Protected Call)
  console.log("\n3. Protected Calls (pcall) inside Lua:");
  const pcallResult = lua.eval(`
    local ok, resultOrError = pcall(function()
      -- Dangerous code that might fail
      error("Something went wrong inside task")
    end)

    if not ok then
      print("Lua pcall caught error successfully: " .. resultOrError)
      return { status = "error_handled", error = resultOrError }
    end
    return { status = "success", result = resultOrError }
  `);
  console.log("pcall Result returned to JS:", pcallResult);

  // 4. Custom Error Handling Functions in Lua
  console.log("\n4. Custom Error Handling Functions in Lua:");
  const customErrorResult = lua.eval(`
    function safeExecute(fn)
      local ok, resultOrError = pcall(fn)
      if ok then
        return { success = true, value = resultOrError }
      else
        return { success = false, error = "[Captured Exception] " .. tostring(resultOrError) }
      end
    end

    return safeExecute(function()
      error("Operation failed safely")
    end)
  `);
  console.log("safeExecute Result:", customErrorResult);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runErrorExample();
}
