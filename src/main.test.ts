import { expect, test } from "vite-plus/test";
import { Lua, runLuaScript } from "./main.ts";

test("runLuaScript evaluates basic expression", () => {
  const result = runLuaScript("return 10 + 20");
  expect(result).toBe(30);
});

test("Lua eval returns primitive types", () => {
  const lua = new Lua();
  expect(lua.eval("return 'hello'")).toBe("hello");
  expect(lua.eval("return true")).toBe(true);
  expect(lua.eval("return false")).toBe(false);
  expect(lua.eval("return 3.14")).toBe(3.14);
  expect(lua.eval("return nil")).toBeUndefined();
});

test("Lua setGlobal and getGlobal", () => {
  const lua = new Lua();
  lua.setGlobal("greeting", "Hello from JS!");
  expect(lua.getGlobal("greeting")).toBe("Hello from JS!");

  lua.setGlobal("num", 100);
  const result = lua.eval("return num * 2");
  expect(result).toBe(200);
});

test("Lua table conversions", () => {
  const lua = new Lua();
  lua.setGlobal("user", { name: "Alice", age: 30 });
  expect(lua.eval("return user.name")).toBe("Alice");
  expect(lua.eval("return user.age")).toBe(30);

  const returnedTable = lua.eval("return { x = 1, y = 2 }") as { x: number; y: number };
  expect(returnedTable).toEqual({ x: 1, y: 2 });
});

test("Lua handles evaluation errors", () => {
  const lua = new Lua();
  expect(() => lua.eval("this is not valid lua code")).toThrow();
});

test("Lua factories (core, empty)", () => {
  const luaCore = Lua.core();
  expect(luaCore.eval("return math.sqrt(16)")).toBe(4);

  const luaEmpty = Lua.empty();
  expect(() => luaEmpty.eval("return math.sqrt(16)")).toThrow();
  luaEmpty.loadCore();
  expect(luaEmpty.eval("return math.sqrt(16)")).toBe(4);
});

test("Lua memory and GC methods", () => {
  const lua = new Lua();
  expect(typeof lua.totalMemory()).toBe("number");
  expect(lua.totalMemory()).toBeGreaterThan(0);

  const metrics = lua.gcMetrics();
  expect(typeof metrics.totalAllocation).toBe("number");
  expect(typeof metrics.allocationDebt).toBe("number");

  expect(() => lua.gcCollect()).not.toThrow();
});

test("Lua registerCallback enables host JS function calls from Lua", () => {
  const lua = new Lua();
  lua.registerCallback("hostAdd", (a: number, b: number) => a + b);
  lua.registerCallback("hostMultiply", (a: number, b: number) => a * b);

  expect(lua.eval("return hostAdd(15, 25)")).toBe(40);
  expect(lua.eval("return hostMultiply(6, 7)")).toBe(42);
});

test("Lua Executor step-based execution and fuel pacing", () => {
  const lua = new Lua();
  const exec = lua.executor(`
    local sum = 0
    for i = 1, 100 do
      sum = sum + i
    end
    return sum
  `);

  // Step with 5 fuel steps (incomplete)
  const step1 = exec.step(5);
  expect(step1.done).toBe(false);
  expect(step1.result).toBeUndefined();

  // Step with sufficient fuel to complete
  const step2 = exec.step(10000);
  expect(step2.done).toBe(true);
  expect(step2.result).toBe(5050);
});
