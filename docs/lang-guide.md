# Lua 5.4 & Ottavino Language Guide

This guide provides an overview of Lua 5.4 language fundamentals, standard library capabilities, and the specific architecture provided by **Ottavino** (the pure Rust Lua 5.4 VM embedded via NAPI).

---

## 1. Lua 5.4 Language Fundamentals

### Primitive Types

Lua is dynamically typed with eight basic types:

| Lua Type   | Description                                                           | JavaScript Equivalent |
| :--------- | :-------------------------------------------------------------------- | :-------------------- |
| `nil`      | Represents non-existence or absence of value                          | `undefined` / `null`  |
| `boolean`  | `true` or `false`                                                     | `boolean`             |
| `number`   | Double-precision floats or 64-bit integers (Lua 5.4 subtype)          | `number`              |
| `string`   | Immutable sequence of bytes / UTF-8 characters                        | `string`              |
| `table`    | Associative array used for objects, dictionaries, and 1-indexed lists | `Object` / `Array`    |
| `function` | First-class functions and closures                                    | `"[lua function]"`    |
| `thread`   | Represents independent coroutines                                     | `"[lua thread]"`      |
| `userdata` | Arbitrary raw memory/host data                                        | `"[lua userdata]"`    |

### Variables & Mutability

By default, variables declared without `local` are **global**:

```lua
-- Global variable
count = 100

-- Local variable (lexically scoped)
local name = "Alloy"

-- Constants (Lua 5.4 <const> annotation)
local MAX_LIMIT <const> = 500
```

### Tables

Tables are Lua's sole data structure, serving as arrays, objects/dictionaries, and classes:

```lua
-- Key-value table (Object)
local user = { name = "Alice", age = 30 }
print(user.name) -- "Alice"

-- 1-indexed sequential table (Array)
local colors = { "red", "green", "blue" }
print(colors[1]) -- "red"
print(#colors)   -- 3 (Length operator)
```

### Control Flow

```lua
if count > 50 then
  print("High")
elseif count > 0 then
  print("Positive")
else
  print("Zero or negative")
end

-- Numeric for loop
for i = 1, 5 do
  print(i)
end

-- Generic for loop
for index, value in ipairs(colors) do
  print(index, value)
end
```

### Functions & Closures

Functions are first-class values in Lua:

```lua
function add(a, b)
  return a + b
end

-- Higher-order function / closure
function makeAdder(amount)
  return function(x)
    return x + amount
  end
end

local addTen = makeAdder(10)
print(addTen(5)) -- 15
```

### Metatables & Object-Oriented Programming

Metatables allow altering table behaviors (operator overloading, custom index access, read-only guards):

```lua
local Config = {}
setmetatable(Config, {
  __index = { host = "localhost", port = 8080 },
  __newindex = function(t, k, v)
    error("Attempt to modify read-only config", 2)
  end
})

print(Config.host) -- "localhost"
```

### Coroutines (Cooperative Multitasking)

Lua supports cooperative concurrency via coroutines:

```lua
local co = coroutine.create(function()
  for i = 1, 3 do
    coroutine.yield(i * 10)
  end
end)

local status, value = coroutine.resume(co) -- value: 10
```

---

## 2. Standard Libraries in Lua 5.4 & Ottavino

In standard C Lua 5.4, the standard library includes:

- **Base Library** (`type`, `assert`, `error`, `pairs`, `ipairs`, `pcall`, `xpcall`, `setmetatable`, `getmetatable`, `tonumber`, `tostring`, etc.)
- **Coroutine Library** (`coroutine.create`, `coroutine.resume`, `coroutine.yield`, `coroutine.status`, etc.)
- **Math Library** (`math.sin`, `math.floor`, `math.random`, `math.pi`, etc.)
- **String Library** (`string.upper`, `string.lower`, `string.sub`, `string.match`, `string.format`, etc.)
- **Table Library** (`table.insert`, `table.remove`, `table.concat`, `table.sort`, etc.)
- **I/O Library** (`io.open`, `io.read`, `io.write`, `print`, etc.)
- **OS Library** (`os.time`, `os.date`, `os.execute`, `os.exit`, etc.)
- **Package / Module Library** (`require`, `package.loaded`, etc.)
- **UTF-8 Library** (`utf8.len`, `utf8.char`, `utf8.codepoint`, etc.)

---

## 3. What Ottavino Adds & Modifies

### Pure Rust Implementation (Zero C Dependencies)

Ottavino is a complete Lua 5.4 interpreter written entirely in safe Rust. Unlike traditional Lua wrappers (`lua54.dll`, `liblua.a`, or `rlua`/`mlua` binding C code), Ottavino compiles directly into native Node.js addons via NAPI without requiring external C libraries or system runtime dependencies.

### Generational & Arena-Based Garbage Collection (`gc-arena`)

Ottavino uses Rust's `gc-arena` crate to manage GC memory allocations safely within Rust's borrow checker. The host application can inspect allocation debt and total memory using `totalMemory()` and trigger GC cycles on demand with `gcCollect()`.

### Sandboxing & Granular Standard Library Control

Ottavino categorizes standard libraries into modular chunks to enable execution in untrusted or restricted environments:

1. **`Lua.empty()`**: Zero libraries loaded. Disables base functions (`type`, `print`, `setmetatable`), creating an isolated sandbox suitable for evaluation of pure mathematical/logical expressions.
2. **`Lua.core()`**: Loads safe core standard libraries:
   - `base`
   - `coroutine`
   - `math`
   - `string`
   - `table`
   - (Omits OS, file system, and raw I/O access)
3. **`Lua.full()` / `loadIo()`**: Enables output and I/O integration (including global `print` and `io.write` output streaming).

### Safe Interoperability with JavaScript/TypeScript

Ottavino seamlessly handles bidirectional value conversion between JavaScript primitives, arrays, objects, and Lua tables/types without risk of memory leaks or native crashes.
