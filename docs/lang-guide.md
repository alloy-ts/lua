# Lua 5.4 Language Guide & Ottavino VM Reference

This guide provides an overview of the Lua 5.4 programming language, its standard library, and the specifics of the **Ottavino** pure-Rust VM engine embedded via `@alloy-ts/lua`.

---

## 1. Lua 5.4 Basics

### Variables & Scopes

Lua variables are global by default unless explicitly declared with `local`.

```lua
-- Global variable
globalVar = "accessible everywhere in the VM state"

-- Local variable
local count = 10
```

### Primitive Types

Lua 5.4 supports 8 basic data types:

1. `nil`: Represents the absence of a value.
2. `boolean`: `true` or `false`.
3. `number`: Signed integers (`i64`) and double-precision floats (`f64`).
4. `string`: Immutable sequence of bytes.
5. `table`: Heterogeneous associative dictionary (used for both arrays and objects).
6. `function`: First-class Lua functions and C/Rust callbacks.
7. `userdata`: Opaque binary data structures managed by the VM allocator.
8. `thread`: Coroutines for cooperative multitasking.

### Constants in Lua 5.4 (`<const>`)

Lua 5.4 introduced local variable attributes, including `<const>`:

```lua
local MAX_LIMIT <const> = 100
-- MAX_LIMIT = 200 -- Re-assignment causes a compile-time or runtime error!
```

### Tables (Arrays & Objects)

Tables are Lua's sole data structuring mechanism:

```lua
-- Key-value dictionary / object
local user = {
  name = "Alice",
  age = 30,
  active = true
}

-- 1-indexed sequential array
local colors = { "red", "green", "blue" }
print(colors[1]) -- "red"
```

### Control Flow

```lua
-- If / Else
if count > 5 then
  print("Greater than 5")
elseif count == 5 then
  print("Equals 5")
else
  print("Smaller")
end

-- Generic For Loop
for index, value in ipairs(colors) do
  print(index, value)
end

-- Numeric For Loop
for i = 1, 5, 1 do
  print(i)
end
```

---

## 2. Lua Standard Library Overview

Lua's standard library provides core modules for string manipulation, mathematical operations, table manipulation, coroutines, and I/O.

### Standard Modules

| Module          | Description                        | Key Functions                                                                                                           |
| :-------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **`base`**      | Core global environment            | `type()`, `tostring()`, `tonumber()`, `assert()`, `error()`, `pcall()`, `setmetatable()`, `getmetatable()`              |
| **`string`**    | String manipulation utilities      | `string.len()`, `string.upper()`, `string.lower()`, `string.sub()`, `string.find()`, `string.format()`, `string.gsub()` |
| **`math`**      | Mathematical functions & constants | `math.abs()`, `math.floor()`, `math.ceil()`, `math.max()`, `math.min()`, `math.pi`, `math.random()`, `math.sqrt()`      |
| **`table`**     | Table array utilities              | `table.insert()`, `table.remove()`, `table.concat()`, `table.sort()`, `table.unpack()`                                  |
| **`coroutine`** | Cooperative multitasking           | `coroutine.create()`, `coroutine.resume()`, `coroutine.yield()`, `coroutine.status()`                                   |
| **`io`**        | File input/output operations       | `io.write()`, `io.read()`, `io.open()`, `io.close()`                                                                    |

---

## 3. What Does Ottavino Add?

### Pure Rust Execution & Memory Safety

Traditional Lua bindings (such as `lua5.4` dynamic libraries or `luajit`) embed C code, requiring `gcc`/`clang` compilers and C-side memory management.

**Ottavino** is a pure Rust implementation of the Lua 5.4 virtual machine:

- **Zero Native C Dependencies**: Compiles completely as a Rust library, enabling effortless cross-compilation across platforms (`x86_64`, `aarch64`, Linux, macOS, Windows, Android, FreeBSDs, and WebAssembly / WASI).
- **Generational GC in Rust (`gc-arena`)**: Memory allocation and garbage collection are managed entirely inside Rust safe-memory bounds via `gc-arena`.
- **Memory Tracking & Budgeting**: Ottavino tracks exact allocator memory in bytes:
  - `lua.totalMemory()`: Inspect exact memory consumed by the VM allocator.
  - `lua.gcMetrics()`: Monitor current memory debt and total allocations.
  - `lua.gcCollect()`: Synchronously trigger garbage collection from TypeScript.
- **Granular Sandboxing**: Allows creating completely isolated Lua execution instances (`Lua.empty()`, `Lua.core()`, `Lua.full()`) with fine-grained library loading (`loadCore()`, `loadIo()`).
