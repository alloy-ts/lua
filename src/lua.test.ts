import { expect, test } from "vite-plus/test";
import { Lua } from "./main.ts";

test("Lua.full creates an instance with full stdlib", () => {
  const lua = Lua.full();
  expect(lua).toBeDefined();
  expect(lua.eval("return math.sqrt(25)")).toBe(5);
  expect(lua.eval('return string.upper("hello")')).toBe("HELLO");
});

test("Lua.core creates an instance with core stdlib", () => {
  const lua = Lua.core();
  expect(lua).toBeDefined();
  expect(lua.eval("return math.abs(-42)")).toBe(42);
});

test("Lua.empty creates an instance without stdlib", () => {
  const lua = Lua.empty();
  expect(lua).toBeDefined();
  expect(lua.eval("return 1 + 1")).toBe(2);
});

test("eval returns correct JavaScript primitives", () => {
  const lua = Lua.full();
  expect(lua.eval("return nil")).toBeUndefined();
  expect(lua.eval("return true")).toBe(true);
  expect(lua.eval("return false")).toBe(false);
  expect(lua.eval("return 100")).toBe(100);
  expect(lua.eval("return 3.14")).toBe(3.14);
  expect(lua.eval('return "Lua NAPI"')).toBe("Lua NAPI");
});

test("Lua retains state across sequential eval calls", () => {
  const lua = Lua.full();
  lua.eval("x = 10");
  lua.eval("y = 20");
  expect(lua.eval("return x + y")).toBe(30);
});

test("eval handles runtime/syntax errors properly", () => {
  const lua = Lua.full();
  expect(() => lua.eval("invalid lua syntax !!!")).toThrow();
  expect(() => lua.eval("error('explicit lua error')")).toThrow();
});

test("setGlobal and getGlobal manage global primitive variables", () => {
  const lua = Lua.full();

  lua.setGlobal("myNum", 999);
  lua.setGlobal("myStr", "hello from JS");
  lua.setGlobal("myBool", true);

  expect(lua.getGlobal("myNum")).toBe(999);
  expect(lua.getGlobal("myStr")).toBe("hello from JS");
  expect(lua.getGlobal("myBool")).toBe(true);
  expect(lua.getGlobal("nonExistent")).toBeUndefined();
});
