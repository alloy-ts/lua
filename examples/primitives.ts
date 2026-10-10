import { Lua } from "../src/main.ts";

export function runPrimitivesExample() {
  const lua = Lua.full();

  console.log("--- Setting Primitive Variables & Constants in Lua from TS ---");

  // 1. Defining Primitives from TypeScript/JavaScript
  lua.setGlobal("MAX_SPEED", 120); // number (integer)
  lua.setGlobal("ACCELERATION", 9.81); // number (float)
  lua.setGlobal("APP_NAME", "Lua Engine"); // string
  lua.setGlobal("IS_ENABLED", true); // boolean
  lua.setGlobal("OPTIONAL_VAL", undefined); // undefined -> nil in Lua

  // 2. Reading Primitives back in TypeScript
  console.log("MAX_SPEED:", lua.getGlobal("MAX_SPEED"));
  console.log("ACCELERATION:", lua.getGlobal("ACCELERATION"));
  console.log("APP_NAME:", lua.getGlobal("APP_NAME"));
  console.log("IS_ENABLED:", lua.getGlobal("IS_ENABLED"));
  console.log("OPTIONAL_VAL:", lua.getGlobal("OPTIONAL_VAL"));

  // 3. Using TS Primitives in Lua Expressions
  const calcResult = lua.eval(
    "return 'App: ' .. APP_NAME .. ', Max Speed in 10s: ' .. (MAX_SPEED + ACCELERATION * 10)",
  );
  console.log("Lua Calculation:", calcResult);

  // 4. Constants in Lua
  // In Lua 5.4, local constants use `<const>`. For global constants set from JS/TS,
  // we can freeze or protect variables in Lua using metatables or convention.
  lua.eval(`
    local CONST_VERSION <const> = "1.0.0"
    print("Lua Local Const:", CONST_VERSION)
  `);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runPrimitivesExample();
}
