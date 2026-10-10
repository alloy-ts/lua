# Lua 5.4 & Ottavino Language & Architecture Guide

This guide covers Lua 5.4 language features, standard library reference, and the internal VM architecture of **Ottavino** (Piccolo) when embedding Lua in TypeScript/JavaScript via NAPI.

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
- [Ottavino VM Architecture & Stackless Design](#ottavino-vm-architecture--stackless-design)
  - [A "Stackless" Interpreter Design](#a-stackless-interpreter-design)
  - [Benefits of a Stackless VM](#benefits-of-a-stackless-vm)
    - [1. Cancellation](#1-cancellation)
    - [2. Pre-emptive Concurrency](#2-pre-emptive-concurrency)
    - [3. Fuel, Pacing, and Custom Scheduling](#3-fuel-pacing-and-custom-scheduling)
    - [4. Symmetric Coroutines (`coroutine.yieldto`)](#4-symmetric-coroutines-coroutineyieldto)
  - [C-Lua vs. Ottavino Architecture](#c-lua-vs-ottavino-architecture)
  - [Safe Garbage Collection (`gc-arena`)](#safe-garbage-collection-gc-arena)
  - [Multi-tenant Sandboxing & Isolation ("Zooming Out")](#multi-tenant-sandboxing--isolation-zooming-out)

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
   Automatically calls the `__close` metamethod when the scope exits.
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

### Base Library
- `print(...)`: Outputs values to stdout.
- `type(v)`: Returns the type name of value `v` as a string (`"number"`, `"table"`, etc.).
- `tostring(v)` / `tonumber(v)`: Converts values to strings or numbers.
- `assert(v, [msg])` / `error(msg)`: Error handling utilities.
- `pcall(f, ...)` / `xpcall(f, msgh, ...)`: Protected call execution (catches runtime errors).
- `pairs(t)` / `ipairs(t)`: Table iterators for dictionaries and arrays.
- `setmetatable(t, meta)` / `getmetatable(t)`: Metatable operations.
- `rawget(t, k)` / `rawset(t, k, v)`: Accesses table fields without invoking metamethods.

### Math Library (`math`)
- `math.abs(x)`, `math.floor(x)`, `math.ceil(x)`, `math.sqrt(x)`
- `math.max(...)`, `math.min(...)`
- `math.sin(x)`, `math.cos(x)`, `math.tan(x)`, `math.rad(deg)`, `math.deg(rad)`
- `math.random([m [, n]])`, `math.randomseed([x [, y]])`
- `math.type(x)`: Returns `"integer"`, `"float"`, or `nil`.
- Constants: `math.pi`, `math.maxinteger`, `math.mininteger`

### String Library (`string`)
- `string.len(s)`: String byte length.
- `string.sub(s, i [, j])`: Extract substring.
- `string.upper(s)` / `string.lower(s)`: Case conversion.
- `string.rep(s, n)`: Repeat string `n` times.
- `string.format(formatstring, ...)`: Formatted string construction.
- `string.find(s, pattern)`, `string.match(s, pattern)`: Pattern matching.
- `string.gsub(s, pattern, repl)`: Global string substitution.

### Table Library (`table`)
- `table.insert(t, [pos,] value)`: Append or insert element into array table.
- `table.remove(t [, pos])`: Remove element from array table.
- `table.concat(t [, sep [, i [, j]]])`: Join string elements with separator.
- `table.sort(t [, comp])`: Sort array elements in-place.
- `table.pack(...)` / `table.unpack(t [, i [, j]])`: Pack arguments into a table or unpack table elements.

### Coroutine Library (`coroutine`)
- `coroutine.create(f)`: Create a new coroutine thread.
- `coroutine.resume(co [, val1, ...])`: Start or resume execution of coroutine.
- `coroutine.yield(...)`: Yield execution back to caller.
- `coroutine.status(co)`: Returns `"running"`, `"suspended"`, `"normal"`, or `"dead"`.

### I/O Library (`io`)
- `io.open(filename [, mode])`: Open file handle.
- `io.read(...)`, `io.write(...)`: Read from / write to file stream.
- `io.lines([filename])`: Iterator over file lines.

---

## Ottavino VM Architecture & Stackless Design

### A "Stackless" Interpreter Design

Ottavino is a pure Rust interpreter for Lua 5.4 built around a **stackless** architecture. Unlike traditional C-Lua implementations (PUC-Rio Lua) which rely on the host C call stack to maintain execution state, Ottavino reifies execution state into explicit, heap-allocated Rust data structures.

Execution in Ottavino is driven from the outside by polling:

```rust
// Polling loop inside Ottavino
loop {
    if executor.step(ctx, &mut fuel) {
        // Execution finished
        break;
    }
    // Execution suspended — control returns to host
}
```

This design mirrors Rust's `Future::poll` model: execution proceeds incrementally and can be suspended, resumed, or yielded at any instruction boundary.

---

### Benefits of a Stackless VM

#### 1. Cancellation
Because execution does not hold frames on the native host call stack, a running Lua tasklet can be safely canceled at any point simply by stopping calls to `executor.step()`. Unreachable VM states and allocated structures are cleaned up deterministically by the garbage collector without memory leaks or dangling pointers.

#### 2. Pre-emptive Concurrency
Standard Lua coroutines provide cooperative multitasking (scripts must explicitly invoke `coroutine.yield()`). In Ottavino, because `Executor::step` executes in bounded time slices governed by fuel, multiple Lua scripts can be multiplexed in a round-robin or custom scheduler to achieve **pre-emptive concurrency** without requiring cooperation from Lua code.

#### 3. Fuel, Pacing, and Custom Scheduling
Execution progress in Ottavino is governed by a `Fuel` budget. Each call to `Executor::step` consumes fuel proportional to the number of VM instructions executed. This enables:
- **Burst Pacing**: Allocating fuel quotas per frame to ensure CPU-intensive Lua scripts cannot hang host Node.js event loops.
- **Resource Sandboxing**: Bounding maximum execution time for untrusted or user-submitted Lua code.

#### 4. Symmetric Coroutines (`coroutine.yieldto`)
Ottavino supports symmetric coroutine switching (`coroutine.yieldto`), allowing one coroutine to yield directly to another without leaking call stack space or requiring outer C wrapper runners.

---

### C-Lua vs. Ottavino Architecture

Traditional C-Lua implementations rely heavily on C stack frames and `longjmp` for yield/error handling, making nested yields across native callbacks complex (`lua_callk` / `lua_yieldk`). Ottavino avoids native stack dependencies altogether by compiling Lua chunks into pure Rust prototypes and stepping them via explicit executor state machines.

---

### Safe Garbage Collection (`gc-arena`)

Ottavino is built on top of `gc-arena`, a garbage collection library for Rust. `gc-arena` enforces strict separation between mutation and collection cycles:
- **Mutation Phase**: Access to garbage-collected handles (`Table<'gc>`, `Closure<'gc>`, etc.) occurs safely inside `lua.enter(|ctx| { ... })`.
- **Collection Phase**: Garbage collection occurs between calls to `enter` or during `Executor::step` polling when no references exist on the host Rust stack.

---

### Multi-tenant Sandboxing & Isolation ("Zooming Out")

In host applications, Ottavino allows creating multiple independent `Lua` VM instances (`Lua.empty()`, `Lua.core()`, `Lua.full()`). Each instance operates in complete isolation with its own garbage-collected heap, global variables, and security boundaries:

```typescript
import { Lua } from "@lib/module";

// Completely isolated sandbox instances
const sandboxA = Lua.empty();
const sandboxB = Lua.full();

sandboxA.loadCore();
```
