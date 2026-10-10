import { Lua } from "../index.js";

export { Lua };

export const runLuaScript = (script: string) => {
  const lua = new Lua();
  return lua.eval(script);
};
