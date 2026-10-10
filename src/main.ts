import {
  Lua as NativeLua,
  __napiBindingTarget,
} from "../dist/index.js";
import type { GcMetrics } from "../dist/index.d.ts";

export class Globals {
  constructor(private lua: NativeLua) {}

  get(name: string): unknown {
    return this.lua.getGlobal(name);
  }

  set(name: string, value: unknown): void {
    this.lua.setGlobal(name, value);
  }
}

export class Lua extends NativeLua {
  private _globals?: Globals;

  static override full(): Lua {
    const inst = super.full();
    Object.setPrototypeOf(inst, Lua.prototype);
    return inst as Lua;
  }

  static override core(): Lua {
    const inst = super.core();
    Object.setPrototypeOf(inst, Lua.prototype);
    return inst as Lua;
  }

  static override empty(): Lua {
    const inst = super.empty();
    Object.setPrototypeOf(inst, Lua.prototype);
    return inst as Lua;
  }

  globals(): Globals {
    if (!this._globals) {
      this._globals = new Globals(this);
    }
    return this._globals;
  }
}

export type { GcMetrics };
export { __napiBindingTarget };

export const main = () => {
  const lua = Lua.full();
  return lua.eval("return 'Hello from Lua!'") as string;
};
