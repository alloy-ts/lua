# Lua 5.4 & Ottavino Language Guide

This guide covers Lua 5.4 basics, its standard library, and the specific capabilities added by **Ottavino** when embedding Lua in TypeScript/JavaScript via NAPI.

---

## Table of Contents

- [Lua 5.4 Language Basics](#lua-54-language-basics)
  - [Data Types](#data-types)
  - [Variables & Scope](#variables--scope)
  - [Lua 5.4 Features (`<const>` & `<close>`)](#lua-54-features-const--close)
  - [Control Flow](#control-flow)
  - [Functions & Closures](#functions--closures)
  - [Tables & Metatables](#tables--metatables)
- [Lua Standard Library Reference](#lua-standard-library-reference)
  - [Base Library](#base-library)
  - [Math Library (`math`)](#math-library-math)
  - [String Library (`string`)](#string-library-string)
  - [Table Library (`table`)](#table-library-table)
  - [Coroutine Library (`coroutine`)](#coroutine-library-coroutine)
  - [I/O Library (`io`)](#io-library-io)
- [What Ottavino Adds](#what-ottavino-adds)
  - [1. Pure Rust Implementation](#1-pure-rust-implementation)
  - [2. Safe Garbage Collection (`gc-arena`)](#2-safe-garbage-collection-gc-arena)
  - [3. Granular Sandboxing & Stdlib Control](#3-granular-sandboxing--stdlib-control)
  - [4. Memory & GC Introspection](#4-memory--gc-introspection)

---

## Lua 5.4 Language Basics

### Data Types

Lua is a dynamically typed language with eight primitive types:

| Type | Description |
| :--- | :--- |
| `nil` | Represents the absence of a value (equivalent to `null`/`undefined`). |
| `boolean` | `true` or `false`. Only `false` and `nil` are falsy in Lua (0 and `""` are truthy!). |
| `number` | Double-precision floats or 64-bit signed integers (Lua 5.4 subtype). |
| `string` | Immutable sequence of bytes / UTF-8 text. |
| `table` | Associative array used for objects, dictionaries, and 1-based arrays. |
| `function` | First-class executable functions and closures. |
| `thread` | Co-routines for cooperative multitasking. |
| `userdata` | Opaque raw memory handles provided by C/Rust host applications. |

### Variables & Scope

Variables are global by default unless declared with `local`:

```lua
globalVar = "accessible everywhere"

do
  local scopedVar = "accessible only within this block"
end
```

### Lua 5.4 Features (`<const>` & `<close>`)

Lua 5.4 introduced attribute annotations for local variables:

1. **Const Variables (`<const>`)**:
   Prevents reassignment to the local variable after initialization.
   ```lua
   local MAX_SIZE <const> = 1024
   -- MAX_SIZE = 2048  --> Compile error in Lua 5.4!
   ```

2. **To-Be-Closed Variables (`<close>`)**:
   Automatically calls the `__close` metamethod when the scope exits (similar to `using` in TS or `try-with-resources`).
   ```lua
   local file <close> = io.open("data.txt", "r")
   -- file is automatically closed when leaving block scope
   ```

### Control Flow

```lua
-- Conditional
if x > 10 then
  print("high")
elseif x > 5 then
  print("medium")
else
  print("low")
end

-- Numerical For Loop
for i = 1, 5, 1 do
  print("Iteration " .. i)
end

-- Generic For Loop (Iterating over Tables)
local colors = { "red", "green", "blue" }
for index, value in ipairs(colors) do
  print(index, value)
end

-- While Loop
local count = 3
while count > 0 do
  count = count - 1
end
```

### Functions & Closures

Functions are first-class values and can return multiple values:

```lua
function calculate(a, b)
  return a + b, a * b
end

local sum, product = calculate(4, 5) -- sum = 9, product = 20

-- Anonymous functions / closures
function makeAdder(x)
  return function(y)
    return x + y
  end
end

local addFive = makeAdder(5)
print(addFive(10)) -- 15
```

### Tables & Metatables

Tables serve as objects, maps, and arrays (arrays use 1-based indexing):

```lua
-- Array-like table
local arr = { "a", "b", "c" }
print(arr[1]) -- "a"
print(#arr)   -- 3 (length operator)

-- Map-like table
local user = { name = "Alice", age = 30 }
print(user.name) -- "Alice"

-- Metatables & Object-Oriented Programming
local Vector = {}
Vector.__index = Vector

function Vector.new(x, y)
  return setmetatable({ x = x, y = y }, Vector)
end

function Vector:length()
  return math.sqrt(self.x^2 + self.y^2)
end

local v = Vector.new(3, 4)
print(v:length()) -- 5
```

---

## Lua Standard Library Reference

Lua standard libraries provide built-in functionality organized into core modules:

### Base Library
The base library provides essential functions directly in the global environment:
- `print(...)`: Outputs values to stdout.
- `type(v)`: Returns the type name of value `v` as a string (`"number"`, `"table"`, etc.).
- `tostring(v)` / `tonumber(v)`: Converts values to strings or numbers.
- `assert(v, [msg])` / `error(msg)`: Error handling utilities.
- `pcall(f, ...)` / `xpcall(f, msgh, ...)`: Protected call execution (catches runtime errors).
- `pairs(t)` / `ipairs(t)`: Table iterators for dictionaries and arrays.
- `setmetatable(t, meta)` / `getmetatable(t)`: Metatable operations.
- `rawget(t, k)` / `rawset(t, k, v)`: Accesses table fields without invoking metamethods.

### Math Library (`math`)
Standard mathematical operations and constants:
- `math.abs(x)`, `math.floor(x)`, `math.ceil(x)`, `math.sqrt(x)`
- `math.max(...)`, `math.min(...)`
- `math.sin(x)`, `math.cos(x)`, `math.tan(x)`, `math.rad(deg)`, `math.deg(rad)`
- `math.random([m [, n]])`, `math.randomseed([x [, y]])`
- `math.type(x)`: Returns `"integer"`, `"float"`, or `nil`.
- Constants: `math.pi`, `math.maxinteger`, `math.mininteger`

### String Library (`string`)
String manipulation and pattern matching:
- `string.len(s)`: String byte length.
- `string.sub(s, i [, j])`: Extract substring.
- `string.upper(s)` / `string.lower(s)`: Case conversion.
- `string.rep(s, n)`: Repeat string `n` times.
- `string.format(formatstring, ...)`: Formatted string construction (C `sprintf` style).
- `string.find(s, pattern)`, `string.match(s, pattern)`: Pattern matching.
- `string.gsub(s, pattern, repl)`: Global string substitution.

### Table Library (`table`)
Utilities for manipulating sequence tables:
- `table.insert(t, [pos,] value)`: Append or insert element into array table.
- `table.remove(t [, pos])`: Remove element from array table.
- `table.concat(t [, sep [, i [, j]]])`: Join string elements with separator.
- `table.sort(t [, comp])`: Sort array elements in-place.
- `table.pack(...)` / `table.unpack(t [, i [, j]])`: Pack arguments into a table or unpack table elements into multiple return values.

### Coroutine Library (`coroutine`)
Cooperative multitasking and generator creation:
- `coroutine.create(f)`: Create a new coroutine thread.
- `coroutine.resume(co [, val1, ...])`: Start or resume execution of coroutine.
- `coroutine.yield(...)`: Yield execution back to caller.
- `coroutine.status(co)`: Returns `"running"`, `"suspended"`, `"normal"`, or `"dead"`.

### I/O Library (`io`)
Filesystem input and output:
- `io.open(filename [, mode])`: Open file handle.
- `io.read(...)`, `io.write(...)`: Read from / write to file stream.
- `io.lines([filename])`: Iterator over file lines.

---

## What Ottavino Adds

When running Lua embedded in JavaScript/TypeScript via NAPI, this library utilizes **Ottavino** as its native VM core. Ottavino provides significant advantages over standard C-Lua embeddings:

### 1. Pure Rust Implementation
- **Zero External C Toolchains**: Built entirely in Rust, eliminating C library compilation (`liblua5.4.a`) or system dynamic library dependencies.
- **Memory Safety**: Completely prevents native C buffer overflows, double frees, or dangling pointer crashes.

### 2. Safe Garbage Collection (`gc-arena`)
- Ottavino uses the `gc-arena` crate to manage GC lifetimes safely within Rust.
- Ensures that references crossing between JavaScript and Lua cannot corrupt host VM memory.

### 3. Granular Sandboxing & Stdlib Control
Standard C-Lua requires manually removing global functions from `_G` to sandbox scripts. Ottavino provides clean, built-in VM constructors for sandboxing:

- **`Lua.empty()`**: Creates a completely blank Lua state with 0 standard libraries loaded. Safe for untrusted user code execution.
- **`Lua.core()`**: Loads core libraries (`math`, `string`, `table`, `coroutine`, `base`) without filesystem or I/O access (`io`).
- **`Lua.full()`**: Loads all libraries including `io`.
- **`loadCore()` / `loadIo()`**: Dynamically enable modules on an existing VM instance on demand.

### 4. Memory & GC Introspection
Ottavino exposes internal allocator metrics directly to JavaScript/TypeScript:

- **`lua.totalMemory()`**: Query exact memory consumption of the Lua VM state in bytes.
- **`lua.gcCollect()`**: Programmatically trigger garbage collection from TypeScript.
- **`lua.gcMetrics()`**: Retrieve allocation debt and total memory statistics via `GcMetrics` (`{ totalAllocation, allocationDebt }`).
