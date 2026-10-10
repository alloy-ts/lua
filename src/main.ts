import { Globals, Lua } from "../dist/index.js";

export { Globals, Lua };

export const main = () => {
  const lua = Lua.full();
  return lua.eval("return 'Hello from Lua!'") as string;
};
