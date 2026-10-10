import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bindings = require("../index.js");

export const { Lua, Context, Function, RuntimeError, ExternError } = bindings;

export const main = () => {
  return "Hello, world!";
};

export default bindings;
