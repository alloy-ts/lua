import { Lua } from "../index.js";

/**
 * Example demonstrating how to define Lua objects (tables) and arrays from TypeScript/JavaScript
 * objects and arrays using NAPI bindings.
 */
export function runObjectExample() {
  const lua = Lua.full();

  console.log("=== Defining Lua Objects (Tables) from TS Objects ===");

  // 1. Define a TypeScript object as a Lua global table
  const userObj = {
    id: 101,
    name: "Alice",
    role: "administrator",
    active: true,
  };

  lua.setGlobal("user", userObj);

  // Access table fields in Lua
  console.log("user.name in Lua:", lua.eval("return user.name")); // "Alice"
  console.log("user.role in Lua:", lua.eval("return user.role")); // "administrator"

  // Retrieve the whole object back from Lua to TS
  const retrievedUser = lua.getGlobal("user");
  console.log("Retrieved user object in TS:", retrievedUser);

  console.log("\n=== Defining Lua Arrays from TS Arrays ===");

  // 2. Define a TypeScript array as a Lua table (1-indexed in Lua)
  const scoresArray = [95, 88, 92, 100];

  lua.setGlobal("scores", scoresArray);

  // Note: Lua tables use 1-based indexing for arrays
  console.log("scores[1] in Lua:", lua.eval("return scores[1]")); // 95
  console.log("Length of scores table in Lua:", lua.eval("return #scores")); // 4

  // Retrieve array back from Lua
  const retrievedScores = lua.getGlobal("scores");
  console.log("Retrieved scores array in TS:", retrievedScores);

  console.log("\n=== Defining Nested Objects and Arrays ===");

  // 3. Complex nested TypeScript object
  const companyData = {
    name: "TechCorp",
    established: 2020,
    departments: ["Engineering", "Product", "Design"],
    settings: {
      maxCapacity: 500,
      remoteAllowed: true,
    },
  };

  lua.setGlobal("company", companyData);

  // Evaluate nested access in Lua
  console.log("company.departments[1] in Lua:", lua.eval("return company.departments[1]")); // "Engineering"
  console.log(
    "company.settings.maxCapacity in Lua:",
    lua.eval("return company.settings.maxCapacity"),
  ); // 500

  // Mutate object fields in Lua
  lua.eval("company.settings.maxCapacity = 600");
  lua.eval("table.insert(company.departments, 'Marketing')");

  console.log("\n=== Object After Lua Mutation ===");
  const updatedCompany = lua.getGlobal("company");
  console.log("Updated company object in TS:", updatedCompany);
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runObjectExample();
}
