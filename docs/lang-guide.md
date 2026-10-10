# Lua 5.4 Language Guide & Standard Library Reference

This guide provides an introduction to Lua 5.4 syntax, standard library modules, and how the underlying **Ottavino** pure-Rust Lua VM exposes standard libraries to JavaScript and TypeScript applications.

For deep architectural details (stackless VM design, `gc-arena`, fuel pacing), see [docs/architecture.md](architecture.md).
For TypeScript API methods and types, see [docs/api.md](api.md).

---

## Overview

[Ottavino](https://github.com/kyren/ottavino) is a pure-Rust implementation of the Lua 5.4 virtual machine and garbage collector (`gc-arena`). Because it runs natively inside Rust compiled to NAPI, it provides:

- **Safety & Isolation**: Run sandboxed Lua scripts safely without C-level memory corruption risks.
- **No Native C Dependencies**: Embedded directly into Node.js via NAPI.
- **Configurable Standard Libraries**: Choose between `empty`, `core`, and `full` standard library sets depending on your security sandboxing needs.

---

## Lua 5.4 Language Basics

### 1. Data Types & Primitives

Lua is a dynamically typed language with eight basic types:

- **`nil`**: Represents the absence of a value.
- **`boolean`**: `true` or `false`. (In Lua, only `false` and `nil` are considered falsey; `0` and `""` are truthy!).
- **`number`**: Double-precision floating point or 64-bit signed integer (`integer`).
- **`string`**: Immutable byte sequence / UTF-8 string. Concatenated using `..` operator.
- **`table`**: Associative array representing arrays, dictionaries, objects, and sets.
- **`function`**: First-class functions and closures.
- **`thread`**: Coroutines for cooperative multitasking.
- **`userdata`**: Opaque host data objects.

### 2. Variables & Lexical Scope

By default, variables declared without `local` are global. Always use `local` for block-scoped variables:

```lua
local maxLimit = 100
local serviceName = "AuthService"
globalConfig = { debug = true } -- Global variable
```

### 3. Control Structures

```lua
-- Conditional Statements
if score >= 90 then
  grade = "A"
elseif score >= 80 then
  grade = "B"
else
  grade = "C"
end

-- Numeric for loop (start, stop, step)
for i = 1, 5, 1 do
  print("Count:", i)
end

-- Generic for loop over array (ipairs)
local items = { "apple", "banana", "cherry" }
for idx, val in ipairs(items) do
  print(idx, val)
end

-- Generic for loop over table key-values (pairs)
local user = { name = "Alice", role = "admin" }
for key, val in pairs(user) do
  print(key, val)
end

-- While and Repeat loops
local n = 3
while n > 0 do
  n = n - 1
end

repeat
  n = n + 1
until n >= 3
```

### 4. Tables and Metatables

Tables are the fundamental data structure in Lua:

```lua
-- Sequence / Array (1-indexed)
local list = { 10, 20, 30 }
print(list[1]) -- 10
print(#list)   -- Length: 3

-- Associative Table / Object
local user = {
  id = 101,
  name = "Bob",
  sayHello = function(self)
    return "Hello, " .. self.name
  end
}
print(user.name)       -- "Bob"
print(user:sayHello()) -- "Hello, Bob"

-- Metatables & Metamethods (e.g. read-only fallback or custom behavior)
local constants = setmetatable({}, {
  __index = { VERSION = "1.0.0" },
  __newindex = function(t, k, v)
    error("Attempt to modify read-only table")
  end
})
print(constants.VERSION) -- "1.0.0"
```

---

## Standard Libraries & Ottavino Subsets

Lua 5.4 provides standard library modules. In this library, you can configure which standard library subsets are loaded into the VM instance.

### Standard Library Subsets

1. **`Lua.empty()`**:
   - Loads no standard libraries.
   - Pure sandbox mode where not even `math` or `print` exist.
   - Ideal for strict domain-specific languages (DSLs) where only custom globals set via `setGlobal()` should be accessible.

2. **`Lua.core()`**:
   - Loads core standard libraries: **Base**, **Math**, **String**, **Table**, and **Coroutine**.
   - Excludes I/O operations.
   - Ideal for secure server-side compute environments.

3. **`Lua.full()`** (or `new Lua()`):
   - Loads all standard libraries including **I/O** (`print`).

---

### Library Module Details

#### 1. Base Library (`loadCore()`)

Provides essential language utilities:

- `type(v)`: Returns string type name (`"nil"`, `"number"`, `"string"`, `"boolean"`, `"table"`, `"function"`, `"thread"`, `"userdata"`).
- `tostring(v)`, `tonumber(v)`: Type conversion functions.
- `assert(v, message)`, `error(message)`: Error triggers.
- `pcall(f, arg1, ...)`: Protected call for catching errors.
- `pairs(t)`, `ipairs(t)`: Table iterators.
- `getmetatable(t)`, `setmetatable(t, mt)`: Metatable management.

#### 2. Math Library (`math`) (`loadCore()`)

Mathematical functions and constants:

- Trigonometry: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`.
- Rounding & Bounds: `math.floor`, `math.ceil`, `math.abs`, `math.max`, `math.min`.
- Exponential & Logarithms: `math.exp`, `math.log`, `math.sqrt`.
- Constants & Random: `math.pi`, `math.huge`, `math.random`, `math.randomseed`.

#### 3. String Library (`string`) (`loadCore()`)

String manipulation utilities:

- `string.upper(s)`, `string.lower(s)`: Case conversion.
- `string.len(s)` or `#s`: String length.
- `string.sub(s, i, j)`: Substring extraction.
- `string.rep(s, n)`: String repetition.
- `string.format(fmt, ...)`: String formatting (printf style).
- Pattern matching: `string.find`, `string.match`, `string.gsub`.

#### 4. Table Library (`table`) (`loadCore()`)

Table manipulation utilities:

- `table.insert(t, [pos,] value)`: Inserts element into sequence.
- `table.remove(t [, pos])`: Removes element from sequence.
- `table.concat(t [, sep [, i [, j]]])`: Joins array items into string.
- `table.pack(...)`, `table.unpack(t)`: Packing and unpacking arguments.
- `table.move(a1, f, e, t [, a2])`: Moves elements between tables.

#### 5. Coroutine Library (`coroutine`) (`loadCore()`)

Cooperative multitasking utilities:

- `coroutine.create(f)`: Creates a new coroutine thread.
- `coroutine.resume(co [, val1, ...])`: Resumes/starts a suspended coroutine.
- `coroutine.yield(...)`: Yields execution back to caller.
- `coroutine.yieldto(targetThread)`: **Symmetric Coroutine Transfer** (unique to Ottavino/Piccolo stackless architecture). Directly transfers execution to `targetThread` without stack accumulation or tail-call leaks.
- `coroutine.status(co)`: Returns `"suspended"`, `"running"`, or `"dead"`.

#### 6. I/O Library (`loadIo()`)

- `print(...)`: Formats and outputs values.

---

## What Ottavino Adds

Ottavino provides a pure-Rust VM implementation of Lua 5.4 based on Piccolo. It adds:

1. **Stackless Architecture**:
   - Reified call stack and trampoline model enabling bounded instruction stepping and non-blocking scheduling.
2. **Symmetric Coroutine Transfer (`coroutine.yieldto`)**:
   - Enables direct mutual yield between coroutines without tail-call leaks or C-stack limitations.
3. **Memory & Allocator Inspection**:
   - Directly exposes allocator statistics (`lua.totalMemory()`, `lua.gcMetrics()`).
4. **Explicit Garbage Collector Triggers**:
   - Allows Node.js applications to manually invoke `lua.gcCollect()`.
5. **Fine-Grained Sandboxing**:
   - Enables fine-grained standard library selection (`Lua.empty()`, `Lua.core()`, `Lua.full()`) and dynamic loading (`loadCore()`, `loadIo()`).
