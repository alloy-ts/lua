import { Lua as NativeLua } from "../dist/index.js";

export class Globals {
  private lua: NativeLua;

  constructor(lua: NativeLua) {
    this.lua = lua;
  }

  /**
   * Retrieves a global variable from the Lua environment.
   */
  get(name: string): unknown {
    return this.lua.getGlobal(name);
  }

  /**
   * Binds a global variable in the Lua environment.
   */
  set(name: string, value: unknown): void {
    this.lua.setGlobal(name, value);
  }
}

export class Lua extends NativeLua {
  private globalsInstance?: Globals;

  static override full(): Lua {
    const instance = NativeLua.full();
    Object.setPrototypeOf(instance, Lua.prototype);
    return instance as Lua;
  }

  static override core(): Lua {
    const instance = NativeLua.core();
    Object.setPrototypeOf(instance, Lua.prototype);
    return instance as Lua;
  }

  static override empty(): Lua {
    const instance = NativeLua.empty();
    Object.setPrototypeOf(instance, Lua.prototype);
    return instance as Lua;
  }

  /**
   * Returns the `Globals` handle for interacting with global variables (`_ENV` / `ctx.globals()`).
   */
  globals(): Globals {
    if (!this.globalsInstance) {
      this.globalsInstance = new Globals(this);
    }
    return this.globalsInstance;
  }
}

export const main = () => {
  const lua = Lua.full();
  return lua.eval("return 'Hello from Lua!'") as string;
};
