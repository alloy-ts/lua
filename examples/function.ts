import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Defining, Registering & Invoking Functions from TS ===");

  const lua = Lua.full();

  // ---------------------------------------------------------------------------
  // 1. Defining Global Functions in Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. Defining Functions inside Lua ---");

  lua.eval(`
    function add(a, b)
      return a + b
    end

    function greet(name)
      return "Hello, " .. name .. "!"
    end
  `);

  const sum = lua.eval("return add(15, 27)");
  const greeting = lua.eval("return greet('TypeScript')");

  console.log("Result of add(15, 27) in Lua:    ", sum);
  console.log("Result of greet('TypeScript'):  ", greeting);

  // ---------------------------------------------------------------------------
  // 2. Registering JS Functions as Host Callbacks in Lua
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Registering TS/JS Callbacks into Lua ---");

  // Bind a TypeScript function into Lua global scope
  lua.registerCallback("hostMultiply", (a: number, b: number) => {
    console.log(`[JS Callback] Called hostMultiply with args (${a}, ${b})`);
    return a * b;
  });

  const product = lua.eval("return hostMultiply(6, 7)");
  console.log("Result of calling hostMultiply(6, 7) from Lua:", product);

  // ---------------------------------------------------------------------------
  // 3. Inspecting Function References in TS via NAPI
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Function References in JS/TS ---");

  const addFnRef = lua.getGlobal("add");
  const hostFnRef = lua.getGlobal("hostMultiply");

  console.log("getGlobal('add') returned:         ", addFnRef);
  console.log("getGlobal('hostMultiply') returned:", hostFnRef);

  console.log("\n=== Demo Complete ===");
}

main();
