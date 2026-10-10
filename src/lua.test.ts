import { expect, test } from "vite-plus/test";
import { Lua } from "../index.js";

test("Lua instantiation and stdlib controls", () => {
  const luaEmpty = Lua.empty();
  expect(luaEmpty).toBeDefined();

  // In an empty Lua state, math module is not loaded
  expect(() => luaEmpty.eval("return math.abs(-5)")).toThrow();

  // Load core stdlib
  luaEmpty.loadCore();
  expect(luaEmpty.eval("return math.abs(-5)")).toBe(5);

  // Load IO stdlib
  luaEmpty.loadIo();

  const luaCore = Lua.core();
  expect(luaCore.eval("return string.upper('hello')")).toBe("HELLO");

  const luaFull = Lua.full();
  expect(luaFull.eval("return type('test')")).toBe("string");

  const luaNew = new Lua();
  expect(luaNew.eval("return 100 + 200")).toBe(300);
});

test("eval primitive types", () => {
  const lua = Lua.full();

  expect(lua.eval("return 42")).toBe(42);
  expect(lua.eval("return 3.14159")).toBeCloseTo(3.14159);
  expect(lua.eval("return 'lua string'")).toBe("lua string");
  expect(lua.eval("return true")).toBe(true);
  expect(lua.eval("return false")).toBe(false);
  expect(lua.eval("return nil")).toBeUndefined();
});

test("eval complex data structures", () => {
  const lua = Lua.full();

  // Sequential table -> JS Array
  expect(lua.eval("return { 'apple', 'banana', 'cherry' }")).toEqual([
    "apple",
    "banana",
    "cherry",
  ]);

  // Key-value table -> JS Object
  expect(lua.eval("return { name = 'Alice', age = 30 }")).toEqual({
    name: "Alice",
    age: 30,
  });

  // Nested structures
  const nested = lua.eval("return { user = { id = 1, tags = { 'admin', 'user' } } }");
  expect(nested).toEqual({
    user: {
      id: 1,
      tags: ["admin", "user"],
    },
  });
});

test("getGlobal and setGlobal bidirectional binding", () => {
  const lua = Lua.full();

  // Set primitive globals from JS
  lua.setGlobal("count", 10);
  lua.setGlobal("message", "NAPI + Lua");
  lua.setGlobal("enabled", true);

  expect(lua.getGlobal("count")).toBe(10);
  expect(lua.getGlobal("message")).toBe("NAPI + Lua");
  expect(lua.getGlobal("enabled")).toBe(true);

  expect(lua.eval("return count + 5")).toBe(15);
  expect(lua.eval("return message .. ' is awesome'")).toBe("NAPI + Lua is awesome");

  // Set objects/arrays from JS
  lua.setGlobal("config", { port: 8080, host: "localhost" });
  expect(lua.eval("return config.port")).toBe(8080);
  expect(lua.eval("return config.host")).toBe("localhost");

  lua.setGlobal("items", [100, 200, 300]);
  expect(lua.eval("return items[1] + items[2] + items[3]")).toBe(600);

  // Unset global (set to null/undefined)
  lua.setGlobal("count", null);
  expect(lua.getGlobal("count")).toBeUndefined();
});

test("memory tracking and garbage collection", () => {
  const lua = Lua.full();

  const initialMem = lua.totalMemory();
  expect(typeof initialMem).toBe("number");
  expect(initialMem).toBeGreaterThan(0);

  // Allocate memory in Lua
  lua.eval("t = {}; for i = 1, 1000 do t[i] = string.rep('x', 100) end");
  const allocatedMem = lua.totalMemory();
  expect(allocatedMem).toBeGreaterThan(initialMem);

  // Free memory and run GC
  lua.eval("t = nil");
  lua.gcCollect();

  const metrics = lua.gcMetrics();
  expect(metrics.totalAllocation).toBeGreaterThan(0);
  expect(typeof metrics.allocationDebt).toBe("number");
});

test("eval error handling", () => {
  const lua = Lua.full();

  // Compile error
  expect(() => lua.eval("function unclosed()")).toThrow(/Lua compile error/);

  // Runtime error
  expect(() => lua.eval("error('custom error')")).toThrow(/Lua runtime error/);
});
