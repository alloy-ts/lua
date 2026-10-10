import { Lua } from "../src/main.ts";

// 1. Instantiate Lua environment
const lua = Lua.full();

console.log("=== Demo 1: Basic JS Callback ===");
// Register a math callback
lua.register("multiply", (a: number, b: number) => {
  return a * b;
});

const result1 = lua.eval("return multiply(6, 7)");
console.log("6 * 7 =", result1); // 42

console.log("\n=== Demo 2: String & Boolean Parameters ===");
// Register a callback taking strings and booleans
lua.register("formatGreeting", (name: string, uppercase: boolean) => {
  const greeting = `Hello, ${name}! Welcome to Lua callbacks.`;
  return uppercase ? greeting.toUpperCase() : greeting;
});

console.log(lua.eval("return formatGreeting('Alloy', false)"));
console.log(lua.eval("return formatGreeting('Alloy', true)"));

console.log("\n=== Demo 3: Returning Objects & Arrays ===");
// Register a callback that returns structured data
lua.register("getUserProfile", (id: number) => {
  return {
    id,
    username: "lua_developer",
    skills: ["TypeScript", "Rust", "Lua"],
    active: true,
  };
});

const script = `
  local user = getUserProfile(101)
  print("User ID:", user.id)
  print("Username:", user.username)
  print("First skill:", user.skills[1])
  return user.skills[1] .. " & " .. user.skills[3]
`;
const result3 = lua.eval(script);
console.log("Combined skills from Lua:", result3);

console.log("\n=== Demo 4: Error Handling with pcall ===");
// Register a callback that throws an exception
lua.register("riskyOperation", (value: number) => {
  if (value < 0) {
    throw new Error("Value cannot be negative!");
  }
  return Math.sqrt(value);
});

const errorScript = `
  local ok, err = pcall(riskyOperation, -5)
  if not ok then
    return "Caught error gracefully in Lua: " .. tostring(err)
  end
  return "Success"
`;
console.log(lua.eval(errorScript));

console.log("\n=== Demo 5: Passing Callbacks via setGlobal ===");
lua.setGlobal("customLogger", (msg: string) => {
  console.log("[JS Logger]:", msg);
  return true;
});

lua.eval("customLogger('Log message originating from Lua code!')");
