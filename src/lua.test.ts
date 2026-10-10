import { describe, expect, test } from "vite-plus/test";
import { runCoroutineDemo } from "../examples/coroutine.ts";
import { runFunctionDemo } from "../examples/function.ts";
import { runGlobalsDemo } from "../examples/globals.ts";
import { runMemoryDemo } from "../examples/memory.ts";
import { runMetatableDemo } from "../examples/metatable.ts";
import { runDemo } from "../examples/object.ts";
import { runStdlibDemo } from "../examples/stdlib.ts";
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
    // A default instance ships with standard libraries like math.
    expect(lua.eval("return math ~= nil")).toBe(true);
  });

  test("Lua.full() exposes standard libraries", () => {
    expect(Lua.full().eval("return math ~= nil")).toBe(true);
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

describe("global variables & Globals API", () => {
  test("setGlobal / getGlobal round-trip scalars", () => {
    const lua = Lua.full();
    lua.setGlobal("num", 10);
    lua.setGlobal("str", "hi");
    lua.setGlobal("flag", true);

    expect(lua.getGlobal("num")).toBe(10);
    expect(lua.getGlobal("str")).toBe("hi");
    expect(lua.getGlobal("flag")).toBe(true);
  });

  test("lua.globals().get / set mirror Ottavino Globals API", () => {
    const lua = Lua.full();
    const globals = lua.globals();
    globals.set("host", "127.0.0.1");
    globals.set("port", 8080);

    expect(globals.get("host")).toBe("127.0.0.1");
    expect(globals.get("port")).toBe(8080);
    expect(lua.eval("return host .. ':' .. port")).toBe("127.0.0.1:8080");
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

describe("JS Function Callbacks in Lua", () => {
  test("registers JS function as callable Ottavino Callback in Lua", () => {
    const lua = Lua.full();
    lua.globals().set("add", (a: number, b: number) => a + b);
    expect(lua.eval("return add(15, 27)")).toBe(42);
  });

  test("handles object and array arguments in JS callback", () => {
    const lua = Lua.full();
    lua.setGlobal("processUser", (user: { name: string; score: number }) => {
      return `User ${user.name} scored ${user.score * 2}`;
    });

    const result = lua.eval("return processUser({ name = 'Alice', score = 50 })");
    expect(result).toBe("User Alice scored 100");
  });

  test("propagates JS errors during callback execution into Lua runtime errors", () => {
    const lua = Lua.full();
    lua.setGlobal("failFunc", () => {
      throw new Error("JS host callback failed!");
    });

    expect(() => lua.eval("failFunc()")).toThrow(/JS host callback failed!/);
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

  test("loadIo() enables standard library loading without throwing", () => {
    const lua = Lua.empty();
    lua.loadCore();
    expect(() => lua.loadIo()).not.toThrow();
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

describe("examples/object.ts demo", () => {
  test("runDemo executes successfully and returns updated object", () => {
    const player = runDemo();
    expect(player.name).toBe("Aria");
    expect(player.score).toBe(150);
    expect(player.inventory).toEqual(["Staff", "Health Potion", "Mana Potion"]);
  });
});

describe("examples/globals.ts demo", () => {
  test("runGlobalsDemo executes successfully and returns primitive and object results", () => {
    const res = runGlobalsDemo();
    expect(res.appName).toBe("Lua Engine");
    expect(res.maxConn).toBe(100);
    expect(res.updatedConfig.port).toBe(9090);
    expect(res.updatedConfig.db.host).toBe("db.internal");
    expect(res.updatedConfig.tags).toEqual(["primary", "us-east", "ssl"]);
    expect(res.summary).toBe("production:9090 (db.internal)");
  });
});

describe("examples/function.ts demo", () => {
  test("runFunctionDemo executes successfully and returns function results", () => {
    const res = runFunctionDemo();
    expect(res.product).toBe(42);
    expect(res.funcRef).toBe("[lua function]");
    expect(res.bounds).toEqual({ min: 3, max: 42 });
    expect(res.doubled).toEqual([2, 4, 6, 8, 10]);
  });
});

describe("examples/coroutine.ts demo", () => {
  test("runCoroutineDemo executes successfully and yields step results", () => {
    const res = runCoroutineDemo();
    expect(res.step1).toEqual({ ok: true, val: 10 });
    expect(res.step2).toEqual({ ok: true, val: 15 });
    expect(res.step3).toEqual({ ok: true, val: 20 });
    expect(res.status).toBe("dead");
    expect(res.taskResults).toEqual([
      "Task A - Step 1",
      "Task B - Step 1",
      "Task A - Finished",
      "Task B - Finished",
    ]);
  });
});

describe("examples/metatable.ts demo", () => {
  test("runMetatableDemo executes successfully and handles metamethods and OOP", () => {
    const res = runMetatableDemo();
    expect(res.v3X).toBe(15);
    expect(res.v3Y).toBe(35);
    expect(res.v3Str).toBe("Vector(15, 35)");
    expect(res.dogSpeak).toBe("Rex makes a woof");
    expect(res.dogBreed).toBe("German Shepherd");
  });
});

describe("examples/memory.ts demo", () => {
  test("runMemoryDemo executes successfully and reports memory usage", () => {
    const res = runMemoryDemo();
    expect(res.initialMemory).toBeGreaterThan(0);
    expect(res.memoryAfterAlloc).toBeGreaterThan(res.initialMemory);
    expect(typeof res.memoryAfterGC).toBe("number");
  });
});

describe("examples/stdlib.ts demo", () => {
  test("runStdlibDemo executes successfully and verifies library loading", () => {
    const res = runStdlibDemo();
    expect(res.mathExpr).toBe(7);
    expect(res.typeErrorOccurred).toBe(true);
    expect(res.typeVal).toBe("number");
    expect(res.stringUpper).toBe("HELLO");
    expect(res.coreMath).toBe(4);
    expect(res.fullMath).toBe(4);
  });
});
