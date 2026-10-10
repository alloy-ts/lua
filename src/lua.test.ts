import { expect, test, describe } from "vite-plus/test";
import { Lua } from "../index.js";

describe("Lua Constructors", () => {
  test("creates instances with different constructors", () => {
    const fullLua = Lua.full();
    expect(fullLua).toBeDefined();

    const coreLua = Lua.core();
    expect(coreLua).toBeDefined();

    const emptyLua = Lua.empty();
    expect(emptyLua).toBeDefined();

    const newLua = new Lua();
    expect(newLua).toBeDefined();
  });
});

describe("Stdlib Loading", () => {
  test("loads core and io libraries dynamically", () => {
    const lua = Lua.empty();

    // In an empty Lua environment, math and print are not loaded
    expect(lua.eval("return math")).toBeUndefined();
    expect(lua.eval("return print")).toBeUndefined();

    // Load core libraries (includes math, table, string, coroutine)
    lua.loadCore();
    expect(lua.eval("return math.sin(0)")).toBe(0);
    expect(lua.eval("return print")).toBeUndefined();

    // Load io library (includes print)
    lua.loadIo();
    expect(lua.eval("return print")).toBe("[lua function]");
  });
});

describe("Lua eval and Type Conversions", () => {
  test("evaluates primitive values", () => {
    const lua = Lua.full();

    expect(lua.eval("return 42")).toBe(42);
    expect(lua.eval("return 3.14159")).toBe(3.14159);
    expect(lua.eval("return 'hello world'")).toBe("hello world");
    expect(lua.eval("return true")).toBe(true);
    expect(lua.eval("return false")).toBe(false);
    expect(lua.eval("return nil")).toBeUndefined();
  });

  test("evaluates mathematical and string operations", () => {
    const lua = Lua.full();

    expect(lua.eval("return 10 + 20 * 3")).toBe(70);
    expect(lua.eval("return 'foo' .. 'bar'")).toBe("foobar");
    expect(lua.eval("return string.upper('hello')")).toBe("HELLO");
    expect(lua.eval("return math.max(5, 12, 3)")).toBe(12);
  });

  test("evaluates tables and arrays", () => {
    const lua = Lua.full();

    expect(lua.eval("return { 1, 2, 3, 4 }")).toEqual([1, 2, 3, 4]);
    expect(lua.eval("return { name = 'Alice', age = 30 }")).toEqual({
      name: "Alice",
      age: 30,
    });
  });

  test("evaluates nested table structures", () => {
    const lua = Lua.full();

    const nested = lua.eval(
      "return { user = { name = 'Bob', tags = { 'admin', 'user' } }, active = true }",
    );
    expect(nested).toEqual({
      user: {
        name: "Bob",
        tags: ["admin", "user"],
      },
      active: true,
    });
  });

  test("returns string representation for complex Lua types", () => {
    const lua = Lua.full();

    expect(lua.eval("return function() end")).toBe("[lua function]");
    expect(lua.eval("return coroutine.create(function() end)")).toBe("[lua thread]");
  });
});

describe("Globals Handle API (lua.globals())", () => {
  test("sets and gets global primitive values via globals() handle", () => {
    const lua = Lua.full();
    const globals = lua.globals();

    globals.set("num", 100);
    expect(globals.get("num")).toBe(100);
    expect(lua.eval("return num + 50")).toBe(150);

    globals.set("str", "Lua + JS");
    expect(globals.get("str")).toBe("Lua + JS");
    expect(lua.eval("return str .. '!'")).toBe("Lua + JS!");

    globals.set("flag", true);
    expect(globals.get("flag")).toBe(true);
    expect(lua.eval("return not flag")).toBe(false);
  });

  test("sets and gets global arrays and objects via globals() handle", () => {
    const lua = Lua.full();
    const globals = lua.globals();

    globals.set("numbers", [10, 20, 30]);
    expect(globals.get("numbers")).toEqual([10, 20, 30]);
    expect(lua.eval("return numbers[1] + numbers[2]")).toBe(30);

    globals.set("config", { env: "production", debug: false });
    expect(globals.get("config")).toEqual({
      env: "production",
      debug: false,
    });
    expect(lua.eval("return config.env")).toBe("production");
  });

  test("handles undefined and null when setting globals", () => {
    const lua = Lua.full();
    const globals = lua.globals();

    globals.set("temp", null);
    expect(globals.get("temp")).toBeUndefined();

    globals.set("temp2", undefined);
    expect(globals.get("temp2")).toBeUndefined();
  });

  test("supports legacy getGlobal and setGlobal wrappers", () => {
    const lua = Lua.full();

    lua.setGlobal("myVal", "hello");
    expect(lua.getGlobal("myVal")).toBe("hello");
    expect(lua.globals().get("myVal")).toBe("hello");
  });
});

describe("Garbage Collection and Memory API", () => {
  test("reports total memory and collects garbage", () => {
    const lua = Lua.full();

    const memBefore = lua.totalMemory();
    expect(typeof memBefore).toBe("number");
    expect(memBefore).toBeGreaterThan(0);

    lua.eval("local t = {}; for i = 1, 1000 do t[i] = i end");
    lua.gcCollect();

    const memAfter = lua.totalMemory();
    expect(typeof memAfter).toBe("number");
    expect(memAfter).toBeGreaterThan(0);

    const metrics = lua.gcMetrics();
    expect(typeof metrics.totalAllocation).toBe("number");
    expect(typeof metrics.allocationDebt).toBe("number");
  });
});

describe("Error Handling", () => {
  test("throws on syntax/compile error", () => {
    const lua = Lua.full();

    expect(() => {
      lua.eval("function unclosed(");
    }).toThrow(/Lua compile error/);
  });

  test("throws on runtime execution error", () => {
    const lua = Lua.full();

    expect(() => {
      lua.eval("return 1 + nil");
    }).toThrow(/Lua runtime error/);

    expect(() => {
      lua.eval("local non_func = 123; non_func()");
    }).toThrow(/Lua runtime error/);
  });
});
