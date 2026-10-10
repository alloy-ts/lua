import { expect, test } from "vite-plus/test";
import { Lua } from "./main.ts";

test("Lua factory constructors and initialization", () => {
  const defaultLua = new Lua();
  expect(defaultLua).toBeDefined();

  const fullLua = Lua.full();
  expect(fullLua).toBeDefined();

  const coreLua = Lua.core();
  expect(coreLua).toBeDefined();

  const emptyLua = Lua.empty();
  expect(emptyLua).toBeDefined();
});

test("Lua eval primitive return values", () => {
  const lua = Lua.full();

  expect(lua.eval("return 42")).toBe(42);
  expect(lua.eval("return 3.14159")).toBe(3.14159);
  expect(lua.eval("return 'Hello from Lua!'")).toBe("Hello from Lua!");
  expect(lua.eval("return true")).toBe(true);
  expect(lua.eval("return false")).toBe(false);
  expect(lua.eval("return nil")).toBeUndefined();
});

test("Lua eval tables and arrays", () => {
  const lua = Lua.full();

  expect(lua.eval("return { 10, 20, 30 }")).toEqual([10, 20, 30]);
  expect(lua.eval("return { name = 'Lua', version = '5.4' }")).toEqual({
    name: "Lua",
    version: "5.4",
  });
});

test("Lua getGlobal and setGlobal", () => {
  const lua = Lua.full();

  lua.setGlobal("num", 100);
  expect(lua.getGlobal("num")).toBe(100);
  expect(lua.eval("return num + 50")).toBe(150);

  lua.setGlobal("greeting", "Hello");
  expect(lua.getGlobal("greeting")).toBe("Hello");
  expect(lua.eval("return greeting .. ', World!'")).toBe("Hello, World!");

  lua.setGlobal("flag", true);
  expect(lua.getGlobal("flag")).toBe(true);

  lua.setGlobal("config", { app: "LuaNAPI", active: true });
  expect(lua.eval("return config.app")).toBe("LuaNAPI");

  lua.setGlobal("list", [1, 2, 3]);
  expect(lua.eval("return list[2]")).toBe(2);
});

test("Lua loadCore and stdlib methods", () => {
  const lua = Lua.empty();

  // In empty state, math and string libraries are undefined
  expect(lua.eval("return math")).toBeUndefined();
  expect(lua.eval("return string")).toBeUndefined();

  // Load core libraries
  lua.loadCore();
  expect(lua.eval("return math.sqrt(16)")).toBe(4);
  expect(lua.eval("return string.upper('lua')")).toBe("LUA");
  expect(lua.eval("return table.concat({'a', 'b', 'c'}, '-')")).toBe("a-b-c");

  // Load I/O library method can be invoked without error
  expect(() => {
    lua.loadIo();
  }).not.toThrow();
});

test("Lua memory and garbage collection", () => {
  const lua = Lua.full();

  const initialMemory = lua.totalMemory();
  expect(typeof initialMemory).toBe("number");
  expect(initialMemory).toBeGreaterThan(0);

  lua.gcCollect();

  const metrics = lua.gcMetrics();
  expect(typeof metrics.totalAllocation).toBe("number");
  expect(typeof metrics.allocationDebt).toBe("number");
  expect(metrics.totalAllocation).toBeGreaterThan(0);
});

test("Lua error handling for compile and runtime errors", () => {
  const lua = Lua.full();

  expect(() => {
    lua.eval("function invalid_syntax(");
  }).toThrow(/Lua compile error/);

  expect(() => {
    lua.eval("error('custom runtime error')");
  }).toThrow(/Lua runtime error/);
});
