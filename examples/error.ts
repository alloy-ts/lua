import { Lua } from "../src/main.ts";

// Create a new Lua VM instance
const lua = Lua.full();

console.log("=== 1. Catching Lua Syntax / Compilation Errors in JS ===");

try {
  // Invalid Lua syntax (unclosed statement / invalid tokens)
  lua.eval("function invalidSyntax( @@@");
} catch (err) {
  console.log("Caught Lua compilation error in JS try/catch:");
  console.log("  Error message:", (err as Error).message);
}

console.log("\n=== 2. Catching Lua Runtime Errors in JS ===");

try {
  // Explicitly raising an error in Lua code using error()
  lua.eval("error('Database connection failed!')");
} catch (err) {
  console.log("Caught explicit Lua runtime error in JS try/catch:");
  console.log("  Error message:", (err as Error).message);
}

try {
  // Lua type mismatch runtime error
  lua.eval("return 10 + 'not_a_number'");
} catch (err) {
  console.log("Caught Lua type error in JS try/catch:");
  console.log("  Error message:", (err as Error).message);
}

console.log("\n=== 3. Protected Calls Inside Lua (pcall) ===");

// In Lua, pcall (protected call) allows handling errors within Lua without crashing execution
const pcallResult = lua.eval(`
  local function riskyFunction(x)
    if x < 0 then
      error("Negative numbers not allowed")
    end
    return x * 2
  end

  local status, result = pcall(riskyFunction, -5)
  return { success = status, errorOrValue = result }
`) as { success: boolean; errorOrValue: string };

console.log("Protected call (pcall) result inside Lua:");
console.log("  Success:", pcallResult.success);
console.log("  Output/Error:", pcallResult.errorOrValue);

console.log("\n=== 4. Custom Error Formatting in Lua ===");

const formattedErrorResult = lua.eval(`
  local function safeExecute(fn, arg)
    local status, err = pcall(fn, arg)
    if not status then
      return false, "[Formatted Error]: " .. tostring(err)
    end
    return true, err
  end

  local status, msg = safeExecute(function(val) error("Internal task failed with code: " .. val) end, 500)
  return { success = status, message = msg }
`) as { success: boolean; message: string };

console.log("Formatted error handling result inside Lua:");
console.log("  Success:", formattedErrorResult.success);
console.log("  Message:", formattedErrorResult.message);
