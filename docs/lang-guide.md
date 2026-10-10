# Lua 5.4 Language & Standard Library Guide

This guide provides an overview of Lua 5.4 fundamentals, its standard library modules, and the features added by the **Ottavino** Lua VM implementation embedded in `@alloy-ts/lua`.

---

## 1. Lua 5.4 Language Fundamentals

Lua is a lightweight, embeddable scripting language. The embedded VM executes standard Lua 5.4 code.

### Primitives & Types

Lua features eight basic data types:

| Type | Description |
| --- | --- |
| `nil` | Represents the absence of a value. |
| `boolean` | `true` or `false`. Note: in Lua, only `false` and `nil` are falsy; `0` and `""` are truthy! |
| `number` | Double-precision floats (`float`) or 64-bit signed integers (`integer`). |
| `string` | Immutable sequence of bytes. |
| `table` | Associative array used for objects, dictionaries, arrays, lists, and records. |
| `function` | First-class function closure. |
| `thread` | Represents a cooperative coroutine thread. |
| `userdata` | Host-provided memory block or custom host structure. |

### Variables & Scopes

Variables in Lua are global by default unless explicitly declared with `local`.

```lua
globalVar = "accessible globally"
local localVar = 42 -- scoped to current block
```

### Tables (Objects & Arrays)

Tables are Lua's sole data structure.

```lua
-- Keyed table (Dictionary / Object)
local user = {
  name = "Jules",
  role = "Developer"
}

-- Sequential table (Array - 1-indexed)
local colors = { "red", "green", "blue" }
print(colors[1]) -- "red"
print(#colors)   -- 3
```

### Functions

Functions are first-class values in Lua.

```lua
local function multiply(a, b)
  return a * b
end

-- Multiple return values
local function minMax(a, b)
  if a < b then return a, b else return b, a end
end
local min, max = minMax(10, 5)
```

---

## 2. Lua 5.4 Standard Library Overview

Lua 5.4 includes a small, modular standard library.

### Base Library
Loaded globally in core and full modes:
* `print(...)`: Outputs values to stdio.
* `type(v)`: Returns the type name string of value `v` (`"nil"`, `"number"`, `"string"`, `"boolean"`, `"table"`, `"function"`, `"thread"`, `"userdata"`).
* `tostring(v)`, `tonumber(v)`: Explicit type conversions.
* `assert(v, [message])`: Raises an error if `v` is false or nil.
* `error(message)`: Raises a Lua runtime error.
* `pairs(t)` / `ipairs(t)`: Iterators for keyed objects / 1-indexed sequential arrays.
* `pcall(fn, ...)` / `xpcall(fn, msgh)`: Protected calls for error catching.
* `setmetatable(t, meta)` / `getmetatable(t)`: Metatable configuration.

### Math Library (`math`)
Mathematical operations and floating-point / integer inspection:
* `math.type(v)`: Differentiates `"integer"` vs `"float"`.
* `math.floor(x)`, `math.ceil(x)`, `math.abs(x)`, `math.sqrt(x)`.
* `math.min(...)`, `math.max(...)`.
* `math.random()`, `math.randomseed(s)`.
* `math.pi`, `math.huge`.

### String Library (`string`)
Pattern matching and string utilities:
* `string.len(s)` / `#s`: Length of string.
* `string.upper(s)`, `string.lower(s)`.
* `string.sub(s, i, j)`: Substring extraction.
* `string.format(fmt, ...)`: Formatted string production.
* `string.find(s, pattern)`, `string.match(s, pattern)`, `string.gsub(s, pattern, repl)`.

### Table Library (`table`)
Utilities for sequential tables (arrays):
* `table.insert(t, [pos], val)`: Inserts element.
* `table.remove(t, [pos])`: Removes element.
* `table.concat(t, [sep])`: Joins array elements into string.
* `table.sort(t, [comp])`: Sorts array in-place.
* `table.pack(...)` / `table.unpack(t)`: Packs / unpacks argument lists.

### Coroutine Library (`coroutine`)
Cooperative multitasking and yield/resume controls:
* `coroutine.create(fn)`: Creates a new coroutine thread.
* `coroutine.resume(co, ...)`: Resumes execution of a coroutine until the next yield or return.
* `coroutine.yield(...)`: Suspends execution and yields values back to `resume`.
* `coroutine.status(co)`: Returns `"suspended"`, `"running"`, `"normal"`, or `"dead"`.

### I/O Library (`io`)
File operations and standard input/output streams:
* `io.write(...)`, `io.read(...)`, `io.open(filename, mode)`.

---

## 3. What Ottavino Adds

[Ottavino](https://github.com/kyren/ottavino) is a pure-Rust, garbage-collected implementation of the Lua 5.4 VM. It introduces several distinct advantages and features when exposed to JavaScript via NAPI:

### 1. Pure Rust & Safe Execution
* **Zero External C Dependencies:** Eliminates security vulnerabilities and cross-compilation friction associated with C code or native pointers.
* **Memory Safety:** Memory is safely tracked in Rust memory arenas (`gc-arena`).

### 2. Fine-Grained Sandboxing Controls
Unlike standard C Lua which loads everything by default, Ottavino lets host applications control standard library access:
* `Lua.empty()`: No stdlib loaded — prevents any ambient environment access.
* `Lua.core()`: Core libraries loaded (base, math, string, table, coroutine) — excludes I/O for safe script evaluation.
* `Lua.full()`: Core + I/O libraries loaded.
* `loadCore()` / `loadIo()`: Incrementally load capabilities into a sandboxed VM on demand.

### 3. Direct Memory Tracking & GC Controls
Ottavino exposes VM memory tracking directly to host languages (TypeScript/JS):
* `lua.totalMemory()`: Query exact byte consumption of the Lua VM.
* `lua.gcCollect()`: Host-driven full garbage collection cycle.
* `lua.gcMetrics()`: Monitor internal GC allocation debt and total allocation tracking.

### 4. Seamless NAPI Bridge
Ottavino's value types seamlessly marshal between JavaScript primitives/objects and Lua VM values:
* JS Numbers automagically map to Lua `integer` or `float`.
* JS Objects map to Lua keyed tables; JS Arrays map to Lua 1-indexed sequential tables.
* JS `undefined` / `null` map to Lua `nil`.
