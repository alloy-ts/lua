import { Lua } from "../src/main.ts";

function main() {
  console.log("=== Demo: Bounded Step Execution and Fuel Polling ===");
  const lua = Lua.core();

  // Create an executor for a long-running computation
  const exec = lua.executor(`
    local sum = 0
    for i = 1, 10000 do
      sum = sum + i
    end
    return sum
  `);

  let step = 1;
  let done = false;

  // Step through the computation in bounded fuel chunks (e.g. 500 fuel units per step)
  while (!done) {
    done = exec.step(lua, 500);
    console.log(`Step ${step}: done = ${done}`);
    step++;
  }

  // Retrieve the final result after execution completes
  const result = exec.takeResult(lua);
  console.log("Final computation result:", result);

  // Test getGlobal
  lua.setGlobal("message", "Hello from getGlobal");
  console.log("getGlobal('message') =>", lua.getGlobal("message"));
}

main();
