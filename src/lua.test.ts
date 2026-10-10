import { describe, expect, test } from "vite-plus/test";
import { Lua } from "./main.ts";

// Exercises the public `Lua` API backed by the Rust/ottavino NAPI binding
// (src/lua.rs). These tests require the native addon to be built so that the
// `Lua` class is actually exported from the binding loader that `src/main.ts`
// imports. Run `npm run build` before `npm test`.

describe("Lua constructors", () => {
  test("new Lua() yields a usable, fully-loaded instance", () => {
    const lua = new Lua();
    expect(lua).toBeDefined();
    expect(typeof lua.eval).toBe("function");
    expect(lua.eval("return 1 + 1")).toBe(2);
    // A default instance ships with the I/O library (which defines print).
    expect(lua.eval("return print ~= nil")).toBe(true);
  });

  test("Lua.full() exposes the I/O library", () => {
    expect(Lua.full().eval("return print ~= nil")).toBe(true);
  });

  test("Lua.core() omits the I/O library", () => {
    expect(Lua.core().eval("return print ~= nil")).toBe(false);
  });

  test("Lua.empty() has no standard library", () => {
    // `type` is a base-library global; it must be absent in an empty state.
    expect(() => Lua.empty().eval("return type(1)")).toThrow();
  });
});

describe("Lua.eval - primitive values", () => {
  const lua = Lua.full();

  test.each([
    ["return 1 + 2 * 3", 7],
    ["return 10 / 4", 2.5],
    ["return 'hello ' .. 'world'", "hello world"],
    ["return true", true],
    ["return false", false],
  ])("eval(%s) === %s", (code, expected) => {
    expect(lua.eval(code)).toBe(expected);
  });

  test("nil evaluates to undefined", () => {
    expect(lua.eval("return nil")).toBeUndefined();
  });
});

describe("Lua.eval - tables", () => {
  const lua = Lua.full();

  test("sequential tables become arrays", () => {
    expect(lua.eval("return { 10, 20, 30 }")).toEqual([10, 20, 30]);
  });

  test("keyed tables become objects", () => {
    expect(lua.eval("return { a = 1, b = 'test' }")).toEqual({
      a: 1,
      b: "test",
    });
  });

  test("nested tables preserve their structure", () => {
    expect(lua.eval("return { a = { b = { c = 1 } } }")).toEqual({
      a: { b: { c: 1 } },
    });
    expect(lua.eval("return { 1, { 2, 3 } }")).toEqual([1, [2, 3]]);
  });

  test("empty table becomes an empty object", () => {
    expect(lua.eval("return {}")).toEqual({});
  });
});

describe("Lua.eval - value conversion", () => {
  const lua = Lua.full();

  test("integers and floats are both returned as numbers", () => {
    expect(lua.eval("return 42")).toBe(42);
    expect(lua.eval("return 3.5")).toBe(3.5);
  });

  test("Lua functions are surfaced as a placeholder string", () => {
    // `print` is a base-library function available on a full instance.
    expect(lua.eval("return print")).toBe("[lua function]");
  });

  test("non-returning statements yield undefined", () => {
    expect(lua.eval("local x = 1")).toBeUndefined();
  });
});

describe("global variables", () => {
  test("lua.globals().set() and lua.globals().get() round-trip scalars", () => {
    const lua = Lua.full();
    const globals = lua.globals();
    globals.set("num", 10);
    globals.set("str", "hi");
    globals.set("flag", true);

    expect(globals.get("num")).toBe(10);
    expect(globals.get("str")).toBe("hi");
    expect(globals.get("flag")).toBe(true);
  });

  test("setGlobal / getGlobal round-trip scalars as alias to globals()", () => {
    const lua = Lua.full();
    lua.setGlobal("num", 10);
    lua.setGlobal("str", "hi");
    lua.setGlobal("flag", true);

    expect(lua.getGlobal("num")).toBe(10);
    expect(lua.getGlobal("str")).toBe("hi");
    expect(lua.getGlobal("flag")).toBe(true);
  });

  test("globals set from JS are visible to later eval calls", () => {
    const lua = Lua.full();
    lua.globals().set("multiplier", 3);
    expect(lua.eval("return multiplier * 4")).toBe(12);
  });

  test("nested tables round-trip through globals (1-indexed arrays)", () => {
    const lua = Lua.full();
    lua.globals().set("cfg", { db: { host: "localhost" }, ports: [1, 2, 3] });

    expect(lua.globals().get("cfg")).toEqual({
      db: { host: "localhost" },
      ports: [1, 2, 3],
    });
    expect(lua.eval("return cfg.db.host")).toBe("localhost");
    expect(lua.eval("return cfg.ports[2]")).toBe(2);
  });

  test("a global defined in Lua is readable via globals().get()", () => {
    const lua = Lua.full();
    lua.eval("shared = 'from lua'");
    expect(lua.globals().get("shared")).toBe("from lua");
  });

  test("an unset global returns undefined", () => {
    const lua = Lua.full();
    expect(lua.globals().get("does_not_exist")).toBeUndefined();
  });
});

describe("standard-library loading", () => {
  test("Lua.empty() evaluates expressions but lacks libraries", () => {
    const lua = Lua.empty();
    // Arithmetic is a VM-level operation, so it works without any stdlib.
    expect(lua.eval("return 1 + 2")).toBe(3);
    // `type` is a base-library global and must be absent here.
    expect(() => lua.eval("return type(1)")).toThrow();
  });

  test("loadCore() enables the core libraries", () => {
    const lua = Lua.empty();
    lua.loadCore();
    expect(lua.eval("return type(1)")).toBe("number");
    expect(lua.eval("return string.upper('abc')")).toBe("ABC");
    expect(lua.eval("return math.floor(3.9)")).toBe(3);
  });

  test("loadIo() enables the I/O library", () => {
    const lua = Lua.empty();
    lua.loadCore();
    lua.loadIo();
    expect(lua.eval("return print ~= nil")).toBe(true);
  });
});

describe("memory and garbage collection", () => {
  test("totalMemory() returns a positive number", () => {
    const lua = Lua.full();
    const memory = lua.totalMemory();
    expect(typeof memory).toBe("number");
    expect(memory).toBeGreaterThan(0);
  });

  test("gcCollect() runs without throwing", () => {
    const lua = Lua.full();
    expect(() => lua.gcCollect()).not.toThrow();
  });

  test("gcMetrics() returns numeric metrics", () => {
    const lua = Lua.full();
    const metrics = lua.gcMetrics();
    expect(typeof metrics.totalAllocation).toBe("number");
    expect(typeof metrics.allocationDebt).toBe("number");
  });
});

describe("calling JS functions from Lua", () => {
  test("setGlobal / globals().set() allows JS functions to be called from Lua", () => {
    const lua = Lua.full();
    lua.globals().set("add", (a: number, b: number) => a + b);
    expect(lua.eval("return add(10, 20)")).toBe(30);
  });

  test("registerCallback allows registering JS callbacks in Lua", () => {
    const lua = Lua.full();
    lua.registerCallback("multiply", (x: number, y: number) => x * y);
    expect(lua.eval("return multiply(6, 7)")).toBe(42);

    lua.globals().registerCallback("concat", (s1: string, s2: string) => s1 + s2);
    expect(lua.eval("return concat('foo', 'bar')")).toBe("foobar");
  });

  test("JS functions can receive and return complex types", () => {
    const lua = Lua.full();
    lua.setGlobal("greet", (user: { name: string }) => {
      return `Hello, ${user.name}!`;
    });
    expect(lua.eval("return greet({ name = 'Alice' })")).toBe("Hello, Alice!");
  });
});

describe("error handling & exception propagation", () => {
  test("syntax errors surface as a compile error", () => {
    const lua = Lua.full();
    expect(() => lua.eval("this is not lua @@@")).toThrow(/Lua compile error/);
  });

  test("runtime errors surface as a runtime error", () => {
    const lua = Lua.full();
    expect(() => lua.eval("error('boom')")).toThrow(/Lua runtime error/);
  });

  test("uncaught JS function errors propagate to JS try/catch", () => {
    const lua = Lua.full();
    lua.setGlobal("fail", () => {
      throw new Error("something went wrong in JS");
    });
    expect(() => lua.eval("fail()")).toThrow(/something went wrong in JS/);
  });

  test("JS function errors can be caught inside Lua using pcall", () => {
    const lua = Lua.full();
    lua.setGlobal("fail", () => {
      throw new Error("js error");
    });
    const result = lua.eval("local ok, err = pcall(fail); return { ok = ok, err = tostring(err) }");
    expect(result).toEqual({
      ok: false,
      err: expect.stringContaining("js error"),
    });
  });
});
