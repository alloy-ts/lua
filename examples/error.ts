import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo 1: Catching Lua compile/syntax error in JS ===");
  const lua = Lua.full();

  try {
    lua.eval("this is invalid lua code +++");
  } catch (err) {
    console.log("Caught compile error in JS:", (err as Error).message);
  }

  console.log("\n=== Demo 2: Catching Lua runtime error in JS ===");
  try {
    lua.eval("error('Something went wrong inside Lua!')");
  } catch (err) {
    console.log("Caught runtime error in JS:", (err as Error).message);
  }

  console.log("\n=== Demo 3: JS exception thrown inside registered callback ===");
  lua.registerCallback("fetchUser", (id: number) => {
    if (id < 0) {
      throw new Error(`Invalid user ID: ${id}`);
    }
    return { id, name: "Alice" };
  });

  // Successful callback invocation from Lua
  const user = lua.eval("return fetchUser(1)");
  console.log("User fetched successfully:", user);

  // Callback throws exception, uncaught in Lua -> bubbles up to JS
  try {
    lua.eval("return fetchUser(-1)");
  } catch (err) {
    console.log("Caught callback exception in JS:", (err as Error).message);
  }

  console.log("\n=== Demo 4: JS callback exception caught inside Lua with pcall ===");
  const pcallResult = lua.eval(`
    local ok, resultOrErr = pcall(fetchUser, -5)
    if not ok then
      return { success = false, message = resultOrErr }
    end
    return { success = true, data = resultOrErr }
  `);
  console.log("Lua pcall result:", pcallResult);
}

main();
