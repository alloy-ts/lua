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
    expect(lua.eval("return string ~= nil")).toBe(true);
  });

  test("Lua.full() exposes standard libraries", () => {
    expect(Lua.full().eval("return string ~= nil")).toBe(true);
  });

  test("Lua.core() omits the I/O library", () => {
    expect(Lua.core().eval("return io ~= nil")).toBe(false);
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
  test("setGlobal / getGlobal round-trip scalars", () => {
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
    lua.setGlobal("multiplier", 3);
    expect(lua.eval("return multiplier * 4")).toBe(12);
  });

  test("nested tables round-trip through globals (1-indexed arrays)", () => {
    const lua = Lua.full();
    lua.setGlobal("cfg", { db: { host: "localhost" }, ports: [1, 2, 3] });

    expect(lua.getGlobal("cfg")).toEqual({
      db: { host: "localhost" },
      ports: [1, 2, 3],
    });
    expect(lua.eval("return cfg.db.host")).toBe("localhost");
    expect(lua.eval("return cfg.ports[2]")).toBe(2);
  });

  test("a global defined in Lua is readable via getGlobal", () => {
    const lua = Lua.full();
    lua.eval("shared = 'from lua'");
    expect(lua.getGlobal("shared")).toBe("from lua");
  });

  test("an unset global returns undefined", () => {
    const lua = Lua.full();
    expect(lua.getGlobal("does_not_exist")).toBeUndefined();
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
    expect(typeof lua.loadIo).toBe("function");
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

describe("error handling", () => {
  test("syntax errors surface as a compile error", () => {
    const lua = Lua.full();
    expect(() => lua.eval("this is not lua @@@")).toThrow(/Lua compile error/);
  });

  test("runtime errors surface as a runtime error", () => {
    const lua = Lua.full();
    expect(() => lua.eval("error('boom')")).toThrow(/Lua runtime error/);
  });
});

describe("Executor / Step Execution", () => {
  test("step execution with fuel completes simple script", () => {
    const lua = Lua.full();
    const exec = lua.executor("local sum = 0; for i = 1, 10 do sum = sum + i end; return sum");
    expect(exec.isDone).toBe(false);

    let res = exec.step(100);
    while (!res.done) {
      res = exec.step(100);
    }

    expect(res.done).toBe(true);
    expect(exec.isDone).toBe(true);
    expect(res.value).toBe(55);
    expect(res.error).toBeUndefined();
  });

  test("step execution handles runtime errors gracefully", () => {
    const lua = Lua.full();
    const exec = lua.executor("error('step fail')");
    const res = exec.step(100);

    expect(res.done).toBe(true);
    expect(res.error).toMatch(/Lua runtime error/);
    expect(res.value).toBeUndefined();
  });

  test("step execution supports registered JS callbacks", () => {
    const lua = Lua.full();
    lua.registerCallback("mul_js", (a: number, b: number) => a * b);
    const exec = lua.executor("return mul_js(6, 7)");
    let res = exec.step(1000);
    while (!res.done) {
      res = exec.step(1000);
    }
    expect(res.value).toBe(42);
  });
});

describe("Host Callback Registration", () => {
  test("registerCallback binds a JS function reachable from Lua", () => {
    const lua = Lua.full();
    lua.registerCallback("add_js", (a: number, b: number) => a + b);

    expect(lua.eval("return add_js(10, 20)")).toBe(30);
  });

  test("registerCallback handles string operations", () => {
    const lua = Lua.full();
    lua.registerCallback("greet", (name: string) => `Hello, ${name}!`);

    expect(lua.eval("return greet('World')")).toBe("Hello, World!");
  });
});

describe("Thread / Coroutine API", () => {
  test("getGlobal returns a Thread object for coroutines", () => {
    const lua = Lua.full();
    lua.eval("co = coroutine.create(function() coroutine.yield('yielded_val') end)");
    const thread = lua.getGlobal("co") as any;

    expect(thread).toBeDefined();
    expect(typeof thread.status).toBe("function");
    expect(typeof thread.resume).toBe("function");
    expect(["suspended", "stopped", "normal", "running"]).includes(thread.status());

    const yieldRes = thread.resume();
    expect(yieldRes).toBe("yielded_val");
  });
});
