import { Lua } from "../index.js";

/**
 * Example demonstrating exception and error handling when executing Lua code:
 * 1. Catching Lua syntax/compile errors in JavaScript/TypeScript using try/catch.
 * 2. Catching Lua runtime errors in JavaScript/TypeScript using try/catch.
 * 3. Handling errors inside Lua using protected calls (`pcall`).
 */
export function runErrorExample() {
  const lua = Lua.full();

  console.log("=== Part 1: Catching Lua Syntax / Compile Errors in TS ===");

  try {
    // Malformed Lua syntax
    lua.eval("function broken(");
  } catch (err) {
    if (err instanceof Error) {
      console.log("TS try/catch caught compile error:");
      console.log("  Error name:", err.name);
      console.log("  Error message:", err.message);
    }
  }

  console.log("\n=== Part 2: Catching Lua Runtime Errors in TS ===");

  try {
    // Attempting arithmetic on nil
    lua.eval("local value = nil; return value + 42");
  } catch (err) {
    if (err instanceof Error) {
      console.log("TS try/catch caught nil arithmetic runtime error:");
      console.log("  Error message:", err.message);
    }
  }

  try {
    // Explicit Lua error() call
    lua.eval("error('Resource not found exception')");
  } catch (err) {
    if (err instanceof Error) {
      console.log("TS try/catch caught explicit Lua error():");
      console.log("  Error message:", err.message);
    }
  }

  console.log("\n=== Part 3: Handling Errors Inside Lua via pcall ===");

  lua.eval(`
    function divide(a, b)
      if b == 0 then
        error("DivisionByZero")
      end
      return a / b
    end
  `);

  // Protected call in Lua prevents the error from bubbling up to TS
  const successResult = lua.eval(
    "local ok, val = pcall(divide, 20, 4); return { ok = ok, val = val }",
  );
  console.log("pcall (valid division):", successResult); // { ok: true, val: 5 }

  const errorResult = lua.eval(
    "local ok, val = pcall(divide, 20, 0); return { ok = ok, val = val }",
  );
  console.log("pcall (division by zero):", errorResult); // { ok: false, val: "DivisionByZero" }
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runErrorExample();
}
