import { Lua } from "../index.js";

export { Lua };

export const main = () => {
  const lua = Lua.full();
  return lua.eval("return 'Hello from Lua!'") as string;
};
