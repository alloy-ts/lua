import { Lua } from "../src/main.ts";

const lua = Lua.full();

console.log("=== Demo: Error & Exception Handling between Lua and JS/TS ===");

// 1. Catching Lua Compile (Syntax) Errors in JS/TS using try/catch
console.log("\n--- 1. Catching Lua Syntax / Compile Errors in JS ---");
try {
  // Invalid Lua syntax
  lua.eval("function badSyntax(a, b return a + b end");
} catch (err: any) {
  console.log("Caught JS exception for Lua compile error:");
  console.log("  Message:", err.message);
  console.log("  Code:", err.code);
}

// 2. Catching Lua Runtime Errors in JS/TS using try/catch
console.log("\n--- 2. Catching Lua Runtime Errors in JS ---");
try {
  // Explicit call to error() in Lua
  lua.eval("error('Database connection failed!')");
} catch (err: any) {
  console.log("Caught JS exception for explicit Lua error():");
  console.log("  Message:", err.message);
}

try {
  // Runtime type error in Lua
  lua.eval("local x = nil; return x.someField");
} catch (err: any) {
  console.log("Caught JS exception for Lua type error:");
  console.log("  Message:", err.message);
}

// 3. Protected Calls in Lua using pcall
// In Lua, pcall (protected call) traps runtime errors inside Lua without raising them to JS.
console.log("\n--- 3. Handling Errors inside Lua using pcall ---");

const pcallResult = lua.eval(`
  local function riskyOperation(amount)
    if amount <= 0 then
      error("Amount must be positive")
    end
    return amount * 2
  end

  -- pcall returns [ok, result_or_err]
  local ok1, res1 = pcall(riskyOperation, 50)
  local ok2, res2 = pcall(riskyOperation, -10)

  return {
    successCall = { ok = ok1, result = res1 },
    failingCall = { ok = ok2, error = res2 }
  }
`);

console.log("Protected call (pcall) results captured in Lua:", pcallResult);
