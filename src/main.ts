import { Lua } from "../index.js";

export { Lua };

/**
 * Convenience helper to evaluate Lua code in a fresh Lua environment.
 */
export function evalLua(code: string): unknown {
  const lua = Lua.full();
  return lua.eval(code);
}
