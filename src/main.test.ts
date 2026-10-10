import { expect, test } from "vite-plus/test";
import { Lua, evalLua } from "./main.ts";

test("evalLua evaluates arithmetic expressions", () => {
  expect(evalLua("return 1 + 2 * 3")).toBe(7);
});

test("evalLua evaluates string operations", () => {
  expect(evalLua('return "Hello " .. "World"')).toBe("Hello World");
});

test("evalLua evaluates boolean operations", () => {
  expect(evalLua("return 10 > 5")).toBe(true);
  expect(evalLua("return 10 < 5")).toBe(false);
});

test("Lua instance maintains state across evaluations", () => {
  const lua = Lua.full();
  lua.eval("a = 15");
  lua.eval("b = 27");
  const result = lua.eval("return a + b");
  expect(result).toBe(42);
});

test("Lua core and empty factories", () => {
  const coreLua = Lua.core();
  expect(coreLua.eval("return math.abs(-5)")).toBe(5);

  const emptyLua = Lua.empty();
  expect(emptyLua.eval("return 100")).toBe(100);
});
