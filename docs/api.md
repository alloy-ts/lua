# API Reference for `@alloy-ts/lua`

The module `dist/index.js` (and `src/main.ts`) exports the main `Lua` class and supporting interface `GcMetrics`.

## Exported Classes & Interfaces

```typescript
export declare class Lua {
  constructor();
  static empty(): Lua;
  static core(): Lua;
  static full(): Lua;

  loadCore(): void;
  loadIo(): void;

  eval(code: string): unknown;
  getGlobal(name: string): unknown;
  setGlobal(name: string, value: unknown): void;

  totalMemory(): number;
  gcCollect(): void;
  gcMetrics(): GcMetrics;
}

export interface GcMetrics {
  totalAllocation: number;
  allocationDebt: number;
}
```

---

## Detailed Method Reference

### Constructors & Static Factories

- **`new Lua()` / `Lua.full()`**
  Creates a new Lua VM instance with the full standard library loaded (base, coroutine, math, string, table, I/O).

- **`Lua.core()`**
  Creates a Lua VM instance with core standard libraries loaded (base, coroutine, math, string, table) excluding I/O.

- **`Lua.empty()`**
  Creates a completely empty sandboxed Lua VM instance with no standard libraries loaded.

---

### Code Execution & Environment Binding

- **`lua.eval(code: string): unknown`**
  Compiles and executes the provided Lua code string.
  Returns the evaluated Lua value converted into its JS equivalent:
  - Primitives: `nil` $\rightarrow$ `undefined`, `boolean` $\rightarrow$ `boolean`, `integer`/`float` $\rightarrow$ `number`, `string` $\rightarrow$ `string`.
  - Tables: Sequential 1-indexed tables $\rightarrow$ `Array`, Keyed tables $\rightarrow$ `Object`.
  - Special values: Functions, threads, userdata $\rightarrow$ placeholder string identifiers.

- **`lua.setGlobal(name: string, value: unknown): void`**
  Sets a global variable in the Lua VM environment. Converts JS values to Lua equivalents:
  - JS `undefined`/`null` $\rightarrow$ Lua `nil`.
  - JS `boolean` $\rightarrow$ Lua `boolean`.
  - JS `number` (integer) $\rightarrow$ Lua `integer`, float $\rightarrow$ Lua `number`.
  - JS `string` $\rightarrow$ Lua `string`.
  - JS `Array` $\rightarrow$ 1-indexed sequential Lua table.
  - JS plain `Object` $\rightarrow$ Keyed Lua table.

- **`lua.getGlobal(name: string): unknown`**
  Retrieves a global variable from the Lua VM environment by name and converts it to a JS value.

---

### Incremental Standard Library Loading

- **`lua.loadCore(): void`**
  Loads core standard libraries into an existing Lua state.

- **`lua.loadIo(): void`**
  Loads I/O standard libraries into an existing Lua state.

---

### Memory & Garbage Collection Controls

- **`lua.totalMemory(): number`**
  Returns the total memory currently used by the Lua VM context in bytes.

- **`lua.gcCollect(): void`**
  Triggers a full garbage collection cycle inside the Lua VM.

- **`lua.gcMetrics(): GcMetrics`**
  Returns a snapshot of the garbage collector metrics:
  - `totalAllocation`: Total bytes tracked by the VM allocator.
  - `allocationDebt`: Current allocation debt.
