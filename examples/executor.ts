import { Lua } from "../index.js";

// Initialize a Lua VM instance
const lua = Lua.full();

console.log("==================================================");
console.log("Lua Step-Based Executor & Fuel Polling Demo");
console.log("==================================================");

// Create a step-driven executor for a long-running calculation
const code = `
  local acc = 0
  for i = 1, 500 do
    acc = acc + i
  end
  return acc
`;

console.log("Creating Executor handle for computation...");
const executor = lua.executor(code);

let isComplete = false;
let stepRound = 0;
const FUEL_PER_STEP = 50;

// Poll the executor with fuel budgets until completion
while (!isComplete && stepRound < 50) {
  stepRound++;
  isComplete = executor.step(lua, FUEL_PER_STEP);
  console.log(`Step round ${stepRound}: complete = ${isComplete}`);
}

if (isComplete) {
  const finalResult = executor.takeResult(lua);
  console.log(`\nComputation finished in ${stepRound} rounds! Result: ${finalResult}`);
} else {
  console.log("\nComputation timed out / cancelled before completion.");
}
