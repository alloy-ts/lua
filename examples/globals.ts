import { Lua } from "../src/main.ts";

// Initialize Lua instance with full standard libraries
const lua = Lua.full();

console.log("=================================================");
console.log("=== Alloy Lua - Comprehensive Globals Example ===");
console.log("=================================================");

console.log("\n--- Section 1: Primitive Types & Variables ---");

// Bind JS primitives to Lua globals
lua.setGlobal("appName", "Lua Service");
lua.setGlobal("versionCode", 42);
lua.setGlobal("ratio", 0.75);
lua.setGlobal("isOnline", true);
lua.setGlobal("missingData", null);

console.log("appName:", lua.getGlobal("appName"), "| Lua type:", lua.eval("return type(appName)"));
console.log(
  "versionCode:",
  lua.getGlobal("versionCode"),
  "| Lua type:",
  lua.eval("return type(versionCode)"),
);
console.log("ratio:", lua.getGlobal("ratio"), "| Lua type:", lua.eval("return type(ratio)"));
console.log(
  "isOnline:",
  lua.getGlobal("isOnline"),
  "| Lua type:",
  lua.eval("return type(isOnline)"),
);
console.log(
  "missingData:",
  lua.getGlobal("missingData"),
  "| Lua type:",
  lua.eval("return type(missingData)"),
);

// Variable mutations
lua.setGlobal("requestCount", 0);
lua.eval("requestCount = requestCount + 1");
console.log("requestCount after increment:", lua.getGlobal("requestCount"));

console.log("\n--- Section 2: Constants & Immutability ---");

const MAX_THREADS = 8;
lua.setGlobal("MAX_THREADS", MAX_THREADS);

console.log("MAX_THREADS:", lua.eval("return 'Max threads: ' .. MAX_THREADS"));

// Enforce read-only semantics via metatable in Lua
lua.eval(`
  SYSTEM_CONSTANTS = {}
  setmetatable(SYSTEM_CONSTANTS, {
    __index = {
      ENV = "production",
      REGION = "us-east-1"
    },
    __newindex = function()
      error("Cannot modify system constants", 2)
    end
  })
`);

console.log("SYSTEM_CONSTANTS.ENV:", lua.eval("return SYSTEM_CONSTANTS.ENV"));

console.log("\n--- Section 3: Objects & Arrays (Tables) ---");

// Plain and nested objects
const appState = {
  status: "active",
  uptime: 3600,
  metrics: {
    cpu: 12.5,
    memoryMb: 128,
  },
};

lua.setGlobal("appState", appState);

console.log("appState from TS:", lua.getGlobal("appState"));
console.log("Nested CPU metric via Lua eval:", lua.eval("return appState.metrics.cpu"));

// Arrays (sequential tables)
const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
lua.setGlobal("logLevels", logLevels);

console.log("logLevels array from TS:", lua.getGlobal("logLevels"));
console.log("Lua 1-based index logLevels[2]:", lua.eval("return logLevels[2]"));

// Object mutation from Lua
lua.eval("appState.status = 'maintenance'");
lua.eval("appState.metrics.memoryMb = appState.metrics.memoryMb + 64");
console.log("Updated appState from Lua script:", lua.getGlobal("appState"));
