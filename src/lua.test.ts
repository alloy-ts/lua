import { expect, test } from "vite-plus/test";
import { Lua } from "./main.ts";

test("Lua empty evaluation", () => {
  const lua = Lua.empty();
  const res = lua.eval("return 1 + 2");
  expect(res).toBe("3");
});

test("Lua core stdlib evaluation", () => {
  const lua = Lua.core();
  const res = lua.eval("return string.upper('hello world')");
  expect(res).toBe("HELLO WORLD");
});

test("Lua full stdlib evaluation", () => {
  const lua = Lua.full();
  const res = lua.eval("return math.sqrt(16)");
  expect(res).toBe("4");
});

test("Lua syntax error throws JavaScript exception", () => {
  const lua = Lua.core();
  expect(() => {
    lua.eval("invalid lua syntax !!!");
  }).toThrow(/parse error/);
});
