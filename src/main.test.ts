import { expect, test } from "vite-plus/test";
import { Lua, main } from "./main.ts";

test("main returns Hello from Lua!", () => {
  expect(main()).toBe("Hello from Lua!");
});

test("Lua factory constructors", () => {
  const fullLua = Lua.full();
  expect(fullLua).toBeDefined();

  const coreLua = Lua.core();
  expect(coreLua).toBeDefined();

  const emptyLua = Lua.empty();
  expect(emptyLua).toBeDefined();

  const newLua = new Lua();
  expect(newLua).toBeDefined();
});

test("eval primitive values", () => {
  const lua = Lua.full();

  expect(lua.eval("return 1 + 2 * 3")).toBe(7);
  expect(lua.eval("return 'hello ' .. 'world'")).toBe("hello world");
  expect(lua.eval("return true")).toBe(true);
  expect(lua.eval("return false")).toBe(false);
  expect(lua.eval("return nil")).toBeUndefined();
});

test("eval tables and arrays", () => {
  const lua = Lua.full();

  expect(lua.eval("return { 10, 20, 30 }")).toEqual([10, 20, 30]);
  expect(lua.eval("return { a = 1, b = 'test' }")).toEqual({ a: 1, b: "test" });
});

test("globals set and get", () => {
  const lua = Lua.full();

  lua.setGlobal("myNum", 42);
  expect(lua.getGlobal("myNum")).toBe(42);
  expect(lua.eval("return myNum * 2")).toBe(84);

  lua.setGlobal("myStr", "embedded lua");
  expect(lua.getGlobal("myStr")).toBe("embedded lua");
  expect(lua.eval("return myStr .. ' rocks'")).toBe("embedded lua rocks");
});

test("globals() API handle", () => {
  const lua = Lua.full();
  const globals = lua.globals();

  globals.set("score", 100);
  expect(globals.get("score")).toBe(100);
  expect(lua.eval("return score + 50")).toBe(150);

  globals.set("add", (x: number, y: number) => x + y);
  expect(lua.eval("return add(12, 34)")).toBe(46);

  const coreLua = Lua.core();
  expect(typeof coreLua.globals).toBe("function");
  coreLua.globals().set("val", 99);
  expect(coreLua.globals().get("val")).toBe(99);
});

test("memory and GC methods", () => {
  const lua = Lua.full();

  const memory = lua.totalMemory();
  expect(typeof memory).toBe("number");
  expect(memory).toBeGreaterThan(0);

  lua.gcCollect();

  const metrics = lua.gcMetrics();
  expect(typeof metrics.totalAllocation).toBe("number");
  expect(typeof metrics.allocationDebt).toBe("number");
});

test("eval syntax error throws", () => {
  const lua = Lua.full();

  expect(() => {
    lua.eval("invalid syntax +++");
  }).toThrow(/Lua compile error/);
});
