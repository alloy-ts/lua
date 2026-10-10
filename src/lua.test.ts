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

test("Globals handle get and set", () => {
  const lua = Lua.full();
  const globals = lua.globals();

  expect(globals).toBeDefined();

  // Set primitive globals via Globals handle
  globals.set("myNum", 42);
  expect(globals.get("myNum")).toBe(42);
  expect(lua.eval("return myNum * 2")).toBe(84);

  globals.set("myStr", "embedded lua");
  expect(globals.get("myStr")).toBe("embedded lua");
  expect(lua.eval("return myStr .. ' rocks'")).toBe("embedded lua rocks");

  // Set objects/arrays via Globals handle
  globals.set("config", { port: 8080, host: "localhost" });
  expect(lua.eval("return config.port")).toBe(8080);
  expect(lua.eval("return config.host")).toBe("localhost");

  globals.set("items", [100, 200, 300]);
  expect(lua.eval("return items[1] + items[2] + items[3]")).toBe(600);

  // Unset global (set to null/undefined)
  globals.set("myNum", null);
  expect(globals.get("myNum")).toBeUndefined();
});

test("Globals handle set JS function as callable Lua function with args and return value", () => {
  const lua = Lua.full();
  const globals = lua.globals();

  let called = false;
  globals.set("hostCallback", () => {
    called = true;
    return "hostResult";
  });

  expect(() => lua.eval("hostCallback()")).not.toThrow();
  expect(called).toBe(true);

  globals.set("addNumbers", (a: number, b: number) => {
    return a + b;
  });

  globals.set("concatStrings", (str1: string, str2: string) => {
    return str1 + " & " + str2;
  });

  expect(lua.eval("return addNumbers(15, 27)")).toBe(42);
  expect(lua.eval("return concatStrings('apples', 'bananas')")).toBe("apples & bananas");
});

test("Executor step polling and fuel management", () => {
  const lua = Lua.full();
  const executor = lua.executor("local sum = 0; for i = 1, 100 do sum = sum + i end; return sum");

  // Step execution until complete
  let finished = false;
  let stepsCount = 0;
  while (!finished && stepsCount < 100) {
    finished = executor.step(lua, 50);
    stepsCount++;
  }

  expect(finished).toBe(true);
  expect(executor.takeResult(lua)).toBe(5050);
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
