import * as bindings from "../index.js";

export const { Lua, LuaExecutor, Context, Function, RuntimeError, ExternError } = bindings;

export const main = () => {
  return "Hello, world!";
};

export default bindings;
