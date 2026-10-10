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
    // A default instance ships with the I/O library.
    expect(lua.eval("return print ~= nil")).toBe(true);
  });

  test("Lua.full() exposes the I/O library", () => {
    expect(Lua.full().eval("return print ~= nil")).toBe(true);
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

describe("global variables via globals()", () => {
  test("globals().set / globals().get round-trip scalars", () => {
    const lua = Lua.full();
    lua.globals().set("num", 10);
    lua.globals().set("str", "hi");
    lua.globals().set("flag", true);

    expect(lua.globals().get("num")).toBe(10);
    expect(lua.globals().get("str")).toBe("hi");
    expect(lua.globals().get("flag")).toBe(true);
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

  test("a global defined in Lua is readable via globals().get", () => {
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

describe("Executor / step execution", () => {
  test("executor runs code step-by-step with fuel", () => {
    const lua = Lua.full();
    const exec = lua.executor("local sum = 0; for i = 1, 100 do sum = sum + i end; return sum");
    expect(exec).toBeDefined();

    let done = false;
    let iterations = 0;
    while (!done && iterations < 1000) {
      done = exec.step(10);
      iterations++;
    }

    expect(done).toBe(true);
    expect(iterations).toBeGreaterThan(1);
    expect(exec.takeResult()).toBe(5050);
  });

  test("executor stop cancels execution", () => {
    const lua = Lua.full();
    const exec = lua.executor("while true do end");
    const doneInitial = exec.step(10);
    expect(doneInitial).toBe(false);
    expect(exec.mode()).toBe("normal");

    exec.stop();
    expect(exec.mode()).toBe("stopped");
  });
});

describe("Coroutine / Thread API", () => {
  test("createThread returns a Thread object in stopped mode", () => {
    const lua = Lua.full();
    const thread = lua.createThread();
    expect(thread).toBeDefined();
    expect(thread.mode()).toBe("stopped");
  });

  test("reset changes thread mode back to stopped", () => {
    const lua = Lua.full();
    const thread = lua.createThread();
    expect(() => thread.reset()).not.toThrow();
    expect(thread.mode()).toBe("stopped");
  });

  test("eval returning coroutines surfaces Thread object", () => {
    const lua = Lua.full();
    const threadObj = lua.eval("return coroutine.create(function() end)");
    expect(threadObj).toBeDefined();
    expect(typeof threadObj).toBe("object");
    expect((threadObj as any).mode()).toBe("suspended");
  });

  test("coroutine yield and resume work via Lua", () => {
    const lua = Lua.full();
    const res = lua.eval(`
      local co = coroutine.create(function(a, b)
        coroutine.yield(a + b)
        return "finished"
      end)
      local ok, val = coroutine.resume(co, 10, 20)
      return { ok = ok, val = val }
    `);
    expect(res).toEqual({ ok: true, val: 30 });
  });
});

describe("Ottavino Callback via globals().set", () => {
  test("wraps JS functions in Callback::from_fn and handles Stack parameters & returns", () => {
    const lua = Lua.full();
    lua.globals().set("hostAdd", (a: number, b: number) => a + b);

    const res = lua.eval("return hostAdd(15, 27)");
    expect(res).toBe(42);
  });

  test("supports string arguments and string return values", () => {
    const lua = Lua.full();
    lua.globals().set("greet", (name: string) => `Hello, ${name}!`);

    const res = lua.eval("return greet('World')");
    expect(res).toBe("Hello, World!");
  });

  test("catches JS errors in callbacks and propagates to Lua pcall/xpcall", () => {
    const lua = Lua.full();
    lua.globals().set("throwError", () => {
      throw new Error("JS host error!");
    });

    const res = lua.eval(`
      local ok, err = pcall(throwError)
      return { ok = ok, err = err }
    `) as { ok: boolean; err: string };

    expect(res.ok).toBe(false);
    expect(res.err).toContain("JS host error!");
  });
});
