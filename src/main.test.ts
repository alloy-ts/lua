import { expect, test } from "vite-plus/test";
import { Lua } from "./main.ts";

test("Lua eval executes lua code and returns result", () => {
  const lua = new Lua();
  expect(lua.eval("return 1 + 2")).toBe("3");
});

test("Lua eval handles string returns", () => {
  const lua = new Lua();
  expect(lua.eval("return 'hello'")).toBe("hello");
});

test("Lua eval handles boolean returns", () => {
  const lua = new Lua();
  expect(lua.eval("return true")).toBe("true");
});
