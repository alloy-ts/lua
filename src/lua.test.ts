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
    // Core library functions are present
    expect(lua.eval("return type('hello')")).toBe("string");
  });

  test("Lua.full() exposes core libraries", () => {
    expect(Lua.full().eval("return type('hello')")).toBe("string");
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

describe("global variables & Globals handle", () => {
  test("globals().set / globals().get round-trip scalars", () => {
    const lua = Lua.full();
    const globals = lua.globals();
    globals.set("num", 10);
    globals.set("str", "hi");
    globals.set("flag", true);

    expect(globals.get("num")).toBe(10);
    expect(globals.get("str")).toBe("hi");
    expect(globals.get("flag")).toBe(true);
  });

  test("globals set from JS are visible to later eval calls", () => {
    const lua = Lua.full();
    lua.globals().set("multiplier", 3);
    expect(lua.eval("return multiplier * 4")).toBe(12);
  });

  test("JS function bound via globals.set is callable directly from Lua", () => {
    const lua = Lua.full();
    lua.globals().set("jsAdd", (a: number, b: number) => a + b);
    expect(lua.eval("return jsAdd(15, 25)")).toBe(40);
  });

  test("JS function receiving multi-type parameters and returning complex table", () => {
    const lua = Lua.full();
    lua.globals().set("processUser", (name: string, age: number, tags: string[]) => {
      return {
        greeting: `Hello ${name}`,
        isAdult: age >= 18,
        tagCount: tags.length,
      };
    });

    const res = lua.eval(`return processUser('Alice', 22, { 'ts', 'lua' })`);
    expect(res).toEqual({
      greeting: "Hello Alice",
      isAdult: true,
      tagCount: 2,
    });
  });

  test("JS function throwing an error is caught in Lua via pcall", () => {
    const lua = Lua.full();
    lua.globals().set("failingFn", () => {
      throw new Error("JS execution failed!");
    });

    const res = lua.eval(`
      local ok, err = pcall(failingFn)
      return { ok = ok, err = tostring(err) }
    `) as { ok: boolean; err: string };

    expect(res.ok).toBe(false);
    expect(res.err).toContain("JS execution failed!");
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

describe("LuaExecutor step execution", () => {
  test("step() evaluates expressions until completion", () => {
    const lua = Lua.full();
    const exec = lua.executor("return 100 + 200");
    expect(exec.isDone()).toBe(false);

    const stepRes = exec.step(100);
    expect(stepRes.done).toBe(true);
    expect(stepRes.value).toBe(300);
    expect(exec.isDone()).toBe(true);
  });

  test("step() pauses on limited fuel and resumes to completion", () => {
    const lua = Lua.full();
    const exec = lua.executor(`
      local sum = 0
      for i = 1, 1000 do
        sum = sum + i
      end
      return sum
    `);

    let done = false;
    let finalValue: unknown;
    while (!done) {
      const res = exec.step(50);
      done = res.done;
      if (done) {
        finalValue = res.value;
      }
    }

    expect(finalValue).toBe(500500);
  });
});

describe("LuaThread coroutines", () => {
  test("createThread() and resume() step through a suspended thread", () => {
    const lua = Lua.full();
    lua.eval(`
      function myWorker()
        local a = coroutine.yield(10)
        return a
      end
    `);

    const thread = lua.createThread("myWorker");
    expect(thread.status()).toBe("suspended");

    const res1 = thread.resume();
    expect(res1).toBe(10);

    const res2 = thread.resume([25]);
    expect(res2).toEqual([25]);
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
