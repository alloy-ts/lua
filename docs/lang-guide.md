# Lua 5.4 Language & Ottavino VM Guide

This guide covers the basics of Lua 5.4, its standard libraries, and the specific behavior and features provided by **Ottavino** (the pure Rust Lua 5.4 VM powering `@alloy-ts/lua`).

---

## Table of Contents

- [1. Lua 5.4 Basics](#1-lua-54-basics)
  - [Types & Primitives](#types--primitives)
  - [Variables & Scope](#variables--scope)
  - [Lua 5.4 `<const>` and `<close>` Variables](#lua-54-const-and-close-variables)
  - [Tables](#tables)
  - [Functions & Closures](#functions--closures)
  - [Coroutines](#coroutines)
  - [Metatables & Metamethods](#metatables--metamethods)
- [2. Standard Libraries in Lua 5.4](#2-standard-libraries-in-lua-54)
  - [Base Library (`base`)](#base-library-base)
  - [Math Library (`math`)](#math-library-math)
  - [String Library (`string`)](#string-library-string)
  - [Table Library (`table`)](#table-library-table)
  - [Coroutine Library (`coroutine`)](#coroutine-library-coroutine)
  - [I/O Library (`io`)](#io-library-io)
- [3. What Ottavino Adds & VM Characteristics](#3-what-ottavino-adds--vm-characteristics)
  - [Pure Rust VM Implementation](#pure-rust-vm-implementation)
  - [Arena Memory Allocation & GC](#arena-memory-allocation--gc)
  - [Sandboxing & Modular Library Loading](#sandboxing--modular-library-loading)
  - [Omitted Modules & Differences from C-Lua](#omitted-modules--differences-from-c-lua)

---

## 1. Lua 5.4 Basics

Lua is a lightweight, dynamically typed scripting language.

### Types & Primitives

Lua has 8 basic types:
- `nil`: Represents the absence of a value (maps to JS `undefined`).
- `boolean`: `true` or `false`.
- `number`: Represents both 64-bit integers (`integer`) and double-precision floating-point numbers (`float`).
- `string`: Immutable sequence of bytes/characters.
- `table`: Associative array (used for objects, hash maps, and 1-indexed sequential arrays).
- `function`: First-class functions/closures.
- `thread`: Represents coroutines for cooperative multitasking.
- `userdata`: Raw memory buffers managed by host C or Rust bindings.

### Variables & Scope

Variables are global by default unless declared with `local`.

```lua
-- Global variable
x = 100

-- Local variable (scoped to block/chunk)
local y = 20

if y > 10 then
  local z = y * 2
  print(z) -- 40
end
-- z is nil here
```

### Lua 5.4 `<const>` and `<close>` Variables

Lua 5.4 introduced variable attributes:

- **`<const>`**: Declares a compile-time constant local variable that cannot be reassigned.
  ```lua
  local MAX_ITEMS <const> = 50
  -- MAX_ITEMS = 100 -- Error: attempt to assign to const variable
  ```

- **`<close>`**: Declares a to-be-closed variable whose `__close` metamethod is automatically invoked when leaving scope.

### Tables

Tables are Lua's sole data structure, used as both arrays (1-indexed) and dictionaries/objects:

```lua
-- Array (1-indexed)
local colors = { "red", "green", "blue" }
print(colors[1]) -- "red"
print(#colors)   -- 3

-- Dictionary / Object
local user = {
  name = "Alice",
  age = 30,
  ["active"] = true
}
print(user.name) -- "Alice"
```

### Functions & Closures

Functions are first-class values and support multiple return values:

```lua
local function addAndSub(a, b)
  return a + b, a - b
end

local sum, diff = addAndSub(10, 4) -- sum = 14, diff = 6

-- Closures
local function makeAdder(x)
  return function(y)
    return x + y
  end
end

local add5 = makeAdder(5)
print(add5(10)) -- 15
```

### Coroutines

Lua provides cooperative multitasking via coroutines:

```lua
local co = coroutine.create(function(start)
  print("Started with", start)
  local y = coroutine.yield(start * 2)
  return y + 10
end)

local ok, val1 = coroutine.resume(co, 5) -- Prints: Started with 5; val1 = 10
local ok, val2 = coroutine.resume(co, 20) -- val2 = 30
```

### Metatables & Metamethods

Metatables allow customizing object behavior (e.g. operator overloading, indexing fallback):

```lua
local myTable = { name = "Item" }
local meta = {
  __index = function(t, key)
    return "default_" .. key
  end
}
setmetatable(myTable, meta)

print(myTable.missingKey) -- "default_missingKey"
```

---

## 2. Standard Libraries in Lua 5.4

The Lua 5.4 standard library consists of built-in functions and modules:

### Base Library (`base`)
Available globally without namespace prefix:
- `print(...)`, `type(v)`, `tostring(v)`, `tonumber(v)`
- `assert(v, msg)`, `error(msg)`, `pcall(f, ...)`
- `pairs(t)`, `ipairs(t)`, `next(t, k)`
- `getmetatable(object)`, `setmetatable(table, metatable)`
- `rawget(t, k)`, `rawset(t, k, v)`, `rawlen(v)`
- `select(index, ...)`, `collectgarbage(opt, arg)`

### Math Library (`math`)
Floating-point and integer math utilities:
- `math.abs`, `math.floor`, `math.ceil`, `math.sin`, `math.cos`, `math.tan`, `math.sqrt`, `math.exp`, `math.log`
- `math.max`, `math.min`, `math.deg`, `math.rad`, `math.fmod`, `math.modf`
- `math.random`, `math.randomseed`
- Constants: `math.pi`, `math.huge`, `math.maxinteger`, `math.mininteger`

### String Library (`string`)
String manipulation:
- `string.len(s)` or `#s`, `string.lower(s)`, `string.upper(s)`, `string.reverse(s)`, `string.rep(s, n)`
- `string.sub(s, i, j)`, `string.byte(s, i, j)`, `string.char(...)`, `string.format(formatstring, ...)`
- Pattern matching: `string.find`, `string.match`, `string.gmatch`, `string.gsub`

### Table Library (`table`)
Utilities for array-style sequential tables:
- `table.insert(list, [pos,] value)`
- `table.remove(list [, pos])`
- `table.concat(list [, sep [, i [, j]]])`
- `table.sort(list [, comp])`
- `table.move(a1, f, e, t [, a2])`
- `table.pack(...)`, `table.unpack(list [, i [, j]])`

### Coroutine Library (`coroutine`)
Cooperative thread management:
- `coroutine.create(f)`, `coroutine.resume(co [, val1, ...])`, `coroutine.yield(...)`
- `coroutine.status(co)`, `coroutine.running()`, `coroutine.wrap(f)`

### I/O Library (`io`)
Basic file I/O streams:
- `io.open`, `io.read`, `io.write`, `io.close`, `io.flush`, `io.type`

---

## 3. What Ottavino Adds & VM Characteristics

**Ottavino** is a pure Rust reimplementation of the Lua 5.4 Virtual Machine (`kyren/ottavino`). It powers `@alloy-ts/lua`.

### Pure Rust VM Implementation
- **Zero Native C Dependencies**: Unlike standard Lua (written in C) or LuaJIT, Ottavino is written entirely in Rust.
- **Safety**: Memory safety guarantees provided by Rust without potential memory leaks or segmentation faults from C library bindings.

### Arena Memory Allocation & GC
- **`gc-arena` Garbage Collection**: Ottavino uses an explicit, safe arena-based garbage collector written in Rust.
- **Memory Inspection API**: Exposes exact memory metrics and controls to JavaScript (`totalMemory()`, `gcCollect()`, `gcMetrics()`).

### Sandboxing & Modular Library Loading
Standard Lua initializes all standard libraries into `_G` automatically. Ottavino provides granular library sandboxing controls via constructors and methods:
- `Lua.empty()`: VM starts with zero libraries loaded (cannot call `print`, `type`, etc.).
- `loadCore()`: Explicitly loads `base`, `coroutine`, `math`, `string`, and `table` modules.
- `loadIo()`: Explicitly loads `io` modules.

### Omitted Modules & Differences from C-Lua
To maintain pure Rust safety and host sandboxing, Ottavino intentionally omits certain standard Lua C libraries:
- **No `package` / `require` module**: Modules cannot load external C libraries or arbitrary filesystem files via `require`.
- **No `os` module**: Eliminates shell command execution (`os.execute`), environment access, or unsafe file removal from sandboxed scripts.
- **No `debug` module**: Prevents arbitrary inspection/modification of call stacks and internal upvalues.
- **No C-FFI / `lua_CFunction`**: C functions cannot be dynamically loaded into the VM.
