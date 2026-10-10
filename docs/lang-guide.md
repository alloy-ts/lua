# Lua 5.4 Language Guide & Standard Library Reference

A guide covering Lua 5.4 language basics, the standard library, and the features provided by the [Ottavino](https://github.com/kyren/ottavino) pure-Rust Lua 5.4 execution engine embedded via NAPI.

---

## Table of Contents

- [1. Lua 5.4 Language Basics](#1-lua-54-language-basics)
  - [Variables & Types](#variables--types)
  - [Tables (Objects & Arrays)](#tables-objects--arrays)
  - [Control Structures](#control-structures)
  - [Functions & Closures](#functions--closures)
  - [Metatables & OOP](#metatables--oop)
- [2. Lua 5.4 Standard Library](#2-lua-54-standard-library)
  - [Base Library (`_G`)](#base-library-_g)
  - [Math Library (`math`)](#math-library-math)
  - [String Library (`string`)](#string-library-string)
  - [Table Library (`table`)](#table-library-table)
  - [Coroutine Library (`coroutine`)](#coroutine-library-coroutine)
  - [I/O Library (`io`)](#io-library-io)
- [3. What Ottavino Adds & Provides](#3-what-ottavino-adds--provides)
  - [Pure Rust Lua 5.4 Virtual Machine](#pure-rust-lua-54-virtual-machine)
  - [Granular Standard Library Sandboxing](#granular-standard-library-sandboxing)
  - [Memory Allocation Tracking & GC Arena Metrics](#memory-allocation-tracking--gc-arena-metrics)
  - [Zero-C-Dependency NAPI & WASM/WASI Readiness](#zero-c-dependency-napi--wasmwasi-readiness)
- [4. WASI p3 & Sandbox Compatibility (`Lua.core()` vs `Lua.full()`)](#4-wasi-p3--sandbox-compatibility-luacore-vs-luafull)

---

## 1. Lua 5.4 Language Basics

### Variables & Types

Lua is dynamically typed with eight basic types:

1. `nil`: Represents absence of value.
2. `boolean`: `true` or `false`.
3. `number`: 64-bit integers and 64-bit floating-point numbers.
4. `string`: Immutable byte sequences (UTF-8 compatible).
5. `table`: Key-value associative arrays used for objects, dictionaries, and arrays.
6. `function`: First-class closures.
7. `thread`: Coroutines.
8. `userdata`: Opaque C/Rust data pointers.

```lua
local x = 42          -- Integer
local pi = 3.14159    -- Float
local name = "Lua"    -- String
local isReady = true  -- Boolean
local empty = nil     -- Nil
```

### Tables (Objects & Arrays)

Tables are Lua's sole data structure:

- **Arrays**: 1-indexed sequential tables (`{ 10, 20, 30 }`).
- **Objects**: Key-value pairs (`{ key = "value" }`).

```lua
-- Array
local colors = { "red", "green", "blue" }
print(colors[1]) -- "red"

-- Object / Table
local user = {
  name = "Alice",
  age = 28,
  roles = { "admin", "dev" }
}
print(user.name) -- "Alice"
```

### Control Structures

```lua
-- If / Else
if score >= 90 then
  grade = "A"
elseif score >= 80 then
  grade = "B"
else
  grade = "C"
end

-- Numeric For Loop
for i = 1, 5 do
  print(i)
end

-- Generic For Loop (Iterating Tables)
for index, value in ipairs(colors) do
  print(index, value)
end

for key, val in pairs(user) do
  print(key, val)
end
```

### Functions & Closures

Functions in Lua are first-class values and support multiple return values, variadic arguments, and lexical closures:

```lua
-- Multi-return values
function minMax(a, b)
  if a < b then return a, b else return b, a end
end

-- Lexical closure
function makeAdder(amount)
  return function(x)
    return x + amount
  end
end

local addTen = makeAdder(10)
print(addTen(5)) -- 15
```

### Metatables & OOP

Metatables allow customizing table behaviors (operator overloading, prototype inheritance, read-only tables via `__index` and `__newindex`):

```lua
Vector = {}
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

## 2. Lua 5.4 Standard Library

Lua 5.4 includes standard modules for basic operations, string processing, math, table manipulation, coroutine concurrency, and file I/O.

### Base Library (`_G`)

Provides essential utility functions in the global environment:

- `print(...)`: Outputs values to standard output.
- `type(v)`: Returns type name (`"number"`, `"string"`, `"table"`, `"function"`, `"boolean"`, `"nil"`, `"thread"`).
- `assert(v, [message])`: Raises an error if `v` is false or nil.
- `error(message, [level])`: Terminates function execution with an error message.
- `select(index, ...)`: Accesses vararg parameters.
- `pcall(f, ...)` / `xpcall(f, msgh, ...)`: Protected function calls (catches errors).
- `tonumber(e, [base])` / `tostring(v)`: Type conversions.
- `pairs(t)` / `ipairs(t)`: Iterators for table key-values and array elements.
- `getmetatable(object)` / `setmetatable(table, metatable)`: Metatable operations.
- `rawget(t, k)` / `rawset(t, k, v)` / `rawequal(a, b)` / `rawlen(v)`: Raw table access bypassing metatables.
- `next(table, [index])`: Low-level table iterator.

### Math Library (`math`)

Provides mathematical functions and constants:

- Constants: `math.pi`, `math.huge`, `math.maxinteger`, `math.mininteger`.
- Trigonometry: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`.
- Arithmetic: `math.abs`, `math.ceil`, `math.floor`, `math.sqrt`, `math.exp`, `math.log`, `math.deg`, `math.rad`.
- Min/Max: `math.max(...)`, `math.min(...)`.
- Randomness: `math.random([m, [n]])`, `math.randomseed([x, [y]])`.
- Type Checking: `math.type(x)` (returns `"integer"`, `"float"`, or `nil`).

### String Library (`string`)

Provides string manipulation and pattern matching utilities:

- Length & Case: `string.len(s)`, `string.upper(s)`, `string.lower(s)`.
- Substrings & Concatenation: `string.sub(s, i, [j])`, `string.rep(s, n)`, `string.reverse(s)`.
- Formatting: `string.format(formatstring, ...)`.
- Pattern Matching: `string.find(s, pattern)`, `string.match(s, pattern)`, `string.gsub(s, pattern, repl)`.
- Byte Conversions: `string.byte(s, [i, [j]])`, `string.char(...)`.

### Table Library (`table`)

Provides algorithms for array-like tables:

- Insertion & Removal: `table.insert(list, [pos,] value)`, `table.remove(list, [pos])`.
- Concatenation: `table.concat(list, [sep, [i, [j]]])`.
- Sorting: `table.sort(list, [comp])`.
- Packing/Unpacking: `table.pack(...)`, `table.unpack(list, [i, [j]])`.
- Slicing/Moving: `table.move(a1, f, e, t, [a2])`.

### Coroutine Library (`coroutine`)

Provides cooperative multitasking and stackful coroutines:

- `coroutine.create(f)`: Creates a new coroutine thread object.
- `coroutine.resume(co, ...)`: Starts or resumes execution of a coroutine.
- `coroutine.yield(...)`: Suspends coroutine execution and returns values to `resume()`.
- `coroutine.status(co)`: Returns coroutine state (`"running"`, `"suspended"`, `"normal"`, or `"dead"`).
- `coroutine.wrap(f)`: Returns a JS/Lua callable function that resumes the coroutine directly.
- `coroutine.running()`: Returns the currently running coroutine thread.
- `coroutine.close(co)`: Closes and terminates a suspended coroutine.

### I/O Library (`io`)

Provides input/output file handles:

- `io.read(...)`, `io.write(...)`, `io.open(filename, [mode])`, `io.flush()`, `io.type(obj)`.

---

## 3. What Ottavino Adds & Provides

[Ottavino](https://github.com/kyren/ottavino) is a pure-Rust Lua 5.4 virtual machine implementation used by this NAPI library. Here is what `ottavino` specifically adds and provides:

### Pure Rust Lua 5.4 Virtual Machine

- **No Native C Dependencies**: Standard Lua wrappers link against C shared libraries (`liblua5.4.so` / `lua54.dll`). Ottavino implements the complete Lua 5.4 interpreter and bytecode executor in pure Rust.
- **Memory Safety**: Memory management is handled inside Rust's safe memory abstractions using the `gc-arena` crate.

### Granular Standard Library Sandboxing

Ottavino allows initializing sandboxed states with exact control over standard library availability:

- **`Lua.empty()`**: Creates a completely unpopulated Lua VM without base functions, math, string, table, or I/O.
- **`Lua.core()`**: Pre-loads base, coroutine, math, string, and table libraries (excluding filesystem/IO operations).
- **`Lua.full()`**: Pre-loads all standard libraries including I/O.
- **Dynamic Loaders**: `lua.loadCore()` and `lua.loadIo()` permit expanding standard libraries on demand.

### Memory Allocation Tracking & GC Arena Metrics

Ottavino exposes total memory consumption and garbage collector metrics directly to JS/TS via NAPI:

- **`lua.totalMemory()`**: Returns total bytes allocated and tracked by the VM allocator.
- **`lua.gcMetrics()`**: Exposes `totalAllocation` (tracked allocation bytes) and `allocationDebt` (pending allocator debt).
- **`lua.gcCollect()`**: Programmatically forces a full garbage collection sweep.

### Zero-C-Dependency NAPI & WASM/WASI Readiness

- Because there are no external C libraries or native C headers required, cross-compiling to WebAssembly (`wasm32-wasip1`, WASI Preview 3, browser builds via `emnapi`) works without installing C cross-compilers or system headers.

---

## 4. WASI p3 & Sandbox Compatibility (`Lua.core()` vs `Lua.full()`)

### `Lua.core()` (and `Lua.empty()`) in WASI p3 Environments

- **Zero I/O Syscall Dependencies**: `Lua.core()` contains only pure in-memory compute modules (`base`, `coroutine`, `math`, `string`, `table`).
- **Fully Compliant with Strict WASI p3 Sandboxes**: Because `Lua.core()` makes zero filesystem or OS handle requests, it runs flawlessly inside strict WASI Preview 3 / WASI Component Model sandboxes where no filesystem (`wasi:filesystem`) or CLI capabilities (`wasi:cli`) are granted.

### `Lua.full()` in WASI p3 Environments

- **Requires WASI I/O Capabilities**: `Lua.full()` includes the `io` library (`io.open`, `io.read`, `io.write`). In WASI p3 / Component Model runtimes, using `Lua.full()` or invoking `loadIo()` requires the host runtime to grant WASI I/O imports (`wasi:cli/stdout`, `wasi:filesystem/preopens`).
- **Recommended Best Practice**: For untrusted user scripts or capability-restricted WASI Preview 3 deployments, use `Lua.core()` or `Lua.empty()` to guarantee isolated execution.
