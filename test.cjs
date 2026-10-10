const assert = require("node:assert");
const test = require("node:test");
const { Lua } = require("./index.js");

test("JS test for Lua class", () => {
  const lua = Lua.full();
  assert.strictEqual(lua.eval('return "NAPI Lua"'), "NAPI Lua");
  assert.strictEqual(lua.eval("return 10 + 25"), 35);
});
