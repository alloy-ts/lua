# Lua 5.4 Language Guide & Standard Library

This guide covers Lua 5.4 language basics, standard library features, and the unique architecture provided by **Ottavino** inside this NAPI-based embedded runtime.

---

## 1. Lua 5.4 Language Basics

Lua is a lightweight, dynamically typed scripting language designed for embedding into host environments like JavaScript and Node.js.

### Types & Literals

- **`nil`**: Represents absence of value (maps to JS `undefined` or `null`).
- **`boolean`**: `true` or `false`.
- **`number`**: Double-precision floating-point numbers or 64-bit signed integers.
- **`string`**: Immutable sequences of bytes or UTF-8 text.
- **`table`**: The fundamental associative data structure (combines hash maps and arrays).
- **`function`**: First-class closures and functions.
- **`userdata`**: Host-managed custom memory pointers.
- **`thread`**: Coroutines for cooperative multitasking.

### Variables & Scope

```lua
-- Global variables (accessible across the execution context)
globalVar = 42

-- Local variables (lexically scoped)
local name = "Alice"

-- Lua 5.4 Constants (<const> attribute)
local MAX_RETRIES <const> = 5
```

### Control Flow

```lua
-- Conditional statements
if x > 10 then
  print("x is large")
elseif x == 10 then
  print("x is ten")
else
  print("x is small")
end

-- Numeric for loop
for i = 1, 5 do
  print("Index:", i)
end

-- Generic for loop over arrays/tables
local items = {"apple", "banana", "cherry"}
for index, value in ipairs(items) do
  print(index, value)
end
```

---

## 2. Standard Library Overview

The standard library in Lua is divided into functional modules:

### Base Library

Core functions implicitly available in global scope:

- **Type Checking & Conversion**: `type()`, `tostring()`, `tonumber()`
- **Assertions & Errors**: `assert()`, `error()`, `pcall()` (protected call), `xpcall()`
- **Metatables**: `getmetatable()`, `setmetatable()`, `rawget()`, `rawset()`, `rawequal()`
- **Iteration**: `pairs()` (hash map key-values), `ipairs()` (1-indexed array elements), `next()`

### Math Library (`math`)

- **Trigonometry**: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`, `math.deg`, `math.rad`
- **Rounding & Bounds**: `math.floor`, `math.ceil`, `math.fmod`, `math.abs`, `math.max`, `math.min`, `math.sqrt`
- **Constants**: `math.pi`, `math.huge` ($\infty$), `math.maxinteger`, `math.mininteger`
- **Type Checking**: `math.type()`, `math.tointeger()`

### String Library (`string`)

- **Formatting & Length**: `string.len`, `string.lower`, `string.upper`, `string.format`, `string.rep`, `string.reverse`, `string.sub`
- **Pattern Matching**: `string.find`, `string.match`, `string.gmatch`, `string.gsub`
- **Binary Packing**: `string.pack`, `string.unpack`, `string.packsize`

### Table Library (`table`)

- **Array Operations**: `table.insert()`, `table.remove()`, `table.move()`
- **Sorting & Joining**: `table.sort()`, `table.concat()`
- **Packing**: `table.pack()`, `table.unpack()`

### Coroutine Library (`coroutine`)

Cooperative multitasking and generator streams:

- `coroutine.create()`, `coroutine.resume()`, `coroutine.yield()`, `coroutine.status()`, `coroutine.wrap()`

### I/O Library (`io`)

Basic standard I/O streams:

- `io.write()`, `io.read()`, `io.flush()`

---

## 3. What Does Ottavino Provide & Add?

[Ottavino](https://crates.io/crates/ottavino) is the pure-Rust implementation of Lua 5.4 used under the hood by this package.

### Key Features Added by Ottavino:

1. **Pure Rust Execution Engine**:
   - Zero C/C++ dependencies or C FFI overhead.
   - Cross-platform memory safety compiled into native `.node` binaries or WASM targets.
2. **GC Arena & Isolation**:
   - Manages Lua garbage collection inside isolated `gc-arena` instances.
   - Prevents memory leaks across JavaScript and Lua runtime boundaries.
3. **Modular Sandboxing**:
   - Allows fine-grained control over library availability:
     - `Lua.empty()`: Completely isolated, no standard libraries.
     - `Lua.core()`: Non-I/O base modules (math, string, table, coroutine).
     - `Lua.full()`: Includes core and I/O capabilities.
4. **Step & Fuel Metering**:
   - Supports bounded execution steps to prevent infinite loop script lockups.
