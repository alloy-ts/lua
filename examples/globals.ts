import { Lua } from "../index.js";

/**
 * Example demonstrating how to manage Lua globals from TypeScript/JavaScript:
 * covering primitives (numbers, strings, booleans, nil), variables/constants,
 * and complex objects (tables, arrays, nested structures).
 */
export function runGlobalsExample() {
  const lua = Lua.full();

  console.log("=== Part 1: Defining Primitives (Numbers, Strings, Booleans, Nil) ===");

  // Numbers (integers & floats)
  lua.setGlobal("MAX_CONNECTIONS", 100);
  lua.setGlobal("PI", 3.14159);

  // Strings
  lua.setGlobal("SERVICE_NAME", "AuthService");

  // Booleans
  lua.setGlobal("FEATURE_ENABLED", true);

  // Nil (null / undefined)
  lua.setGlobal("UNSET_VAR", null);

  // Verification via eval & getGlobal
  console.log("MAX_CONNECTIONS:", lua.eval("return MAX_CONNECTIONS")); // 100
  console.log("PI:", lua.eval("return PI")); // 3.14159
  console.log("SERVICE_NAME:", lua.eval("return SERVICE_NAME")); // "AuthService"
  console.log("FEATURE_ENABLED:", lua.eval("return FEATURE_ENABLED")); // true
  console.log("UNSET_VAR:", lua.eval("return UNSET_VAR")); // undefined
  console.log("getGlobal('SERVICE_NAME'):", lua.getGlobal("SERVICE_NAME")); // "AuthService"

  console.log("\n=== Part 2: Defining Variables and Constants in Lua ===");

  // Global variable in Lua code
  lua.eval("counter = 1");
  console.log("Initial counter:", lua.getGlobal("counter"));

  lua.eval("counter = counter + 1");
  console.log("Updated counter:", lua.getGlobal("counter"));

  // Read-only constant table using metatables
  lua.eval(`
    CONSTANTS = setmetatable({}, {
      __index = { APP_VERSION = "2.1.0", ENV = "production" },
      __newindex = function() error("Attempt to modify read-only constant table") end
    })
  `);
  console.log("Read-only APP_VERSION:", lua.eval("return CONSTANTS.APP_VERSION"));

  console.log("\n=== Part 3: Defining Objects (Tables) and Arrays ===");

  // Objects -> Lua Tables
  const userObj = {
    id: 101,
    name: "Alice",
    role: "administrator",
    active: true,
  };
  lua.setGlobal("user", userObj);

  console.log("user.name in Lua:", lua.eval("return user.name")); // "Alice"
  console.log("Retrieved user in TS:", lua.getGlobal("user"));

  // Arrays -> 1-indexed Lua Tables
  const scoresArray = [95, 88, 92, 100];
  lua.setGlobal("scores", scoresArray);

  console.log("scores[1] in Lua:", lua.eval("return scores[1]")); // 95
  console.log("Length of scores (#scores):", lua.eval("return #scores")); // 4
  console.log("Retrieved scores in TS:", lua.getGlobal("scores"));

  console.log("\n=== Part 4: Nested Structures and Lua Mutations ===");

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

  console.log("company.departments[1] in Lua:", lua.eval("return company.departments[1]")); // "Engineering"

  // Mutate table fields inside Lua
  lua.eval("company.settings.maxCapacity = 600");
  lua.eval("table.insert(company.departments, 'Marketing')");

  console.log("Updated company object in TS:", lua.getGlobal("company"));
}

// Execute the example when run directly
if (import.meta.url.endsWith(process.argv[1])) {
  runGlobalsExample();
}
