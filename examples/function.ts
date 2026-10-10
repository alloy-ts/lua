import { Lua } from "../src/main.ts";

export function runFunctionExample() {
  const lua = Lua.full();

  console.log("=== Defining and Calling Functions in Lua from TS ===");

  // 1. Defining a Lua function in script and returning/calling it
  lua.eval(`
    function addNumbers(a, b)
      return a + b
    end

    function greetUser(name, title)
      title = title or "Guest"
      return "Hello " .. title .. " " .. name
    end
  `);

  // 2. Calling defined Lua functions via eval
  const sum = lua.eval("return addNumbers(15, 27)");
  console.log("addNumbers(15, 27) ->", sum);

  const greeting = lua.eval("return greetUser('Alice', 'Dr.')");
  console.log("greetUser('Alice', 'Dr.') ->", greeting);

  // 3. Inspecting Lua function values in TypeScript
  // When a Lua function is retrieved in JS/TS, NAPI surfaces it as a placeholder indicator string:
  const fnValue = lua.getGlobal("addNumbers");
  console.log("getGlobal('addNumbers') in TS ->", fnValue); // "[lua function]"

  // 4. Higher-Order Functions in Lua
  lua.eval(`
    function applyTransform(arr, transformFn)
      local result = {}
      for i, v in ipairs(arr) do
        table.insert(result, transformFn(v))
      end
      return result
    end

    function square(x)
      return x * x
    end
  `);

  lua.setGlobal("numbers", [1, 2, 3, 4, 5]);
  const squaredList = lua.eval("return applyTransform(numbers, square)");
  console.log("applyTransform([1..5], square) ->", squaredList);
}

if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runFunctionExample();
}
