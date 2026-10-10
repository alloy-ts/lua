# Lua 5.4 Language & Ottavino (Piccolo) VM Guide

This guide covers the basics of Lua 5.4, its standard libraries, and the underlying architecture, features, and capabilities provided by **Ottavino** (the pure Rust Lua 5.4 VM based on **Piccolo**, powering `@alloy-ts/lua`).

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
- [3. Deep Dive: Ottavino / Piccolo Architecture & Features](#3-deep-dive-ottavino--piccolo-architecture--features)
  - [The 13 Core Ottavino Architecture Types](#the-13-core-ottavino-architecture-types)
  - [A "Stackless" Interpreter Design](#a-stackless-interpreter-design)
  - [Benefits of Stackless Architecture](#benefits-of-stackless-architecture)
    - [1. Cancellation](#1-cancellation)
    - [2. Pre-emptive Concurrency & Tasklets](#2-pre-emptive-concurrency--tasklets)
    - [3. Fuel, Pacing, and Custom Scheduling](#3-fuel-pacing-and-custom-scheduling)
    - [4. "Symmetric" Coroutines and `coroutine.yieldto`](#4-symmetric-coroutines-and-coroutineyieldto)
  - [The "Big Lie" (Comparison with PUC-Rio C-Lua & `lua_callk`)](#the-big-lie-comparison-with-puc-rio-c-lua--lua_callk)
  - [Rust Coroutines, Lua Coroutines, and Snarfing](#rust-coroutines-lua-coroutines-and-snarfing)
  - [Arena Memory Allocation & GC (`gc-arena`)](#arena-memory-allocation--gc-gc-arena)
  - [Sandboxing & Modular Library Loading](#sandboxing--modular-library-loading)

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
- **`coroutine.yieldto(co, ...)`**: *Unique to Ottavino/Piccolo!* Performs symmetric coroutine yields without leaking stack space.

### I/O Library (`io`)
Basic file I/O streams:
- `io.open`, `io.read`, `io.write`, `io.close`, `io.flush`, `io.type`

---

## 3. Deep Dive: Ottavino / Piccolo Architecture & Features

**Ottavino** is a pure Rust reimplementation of the Lua 5.4 Virtual Machine (`kyren/ottavino`, built on **Piccolo**). It powers `@alloy-ts/lua`.

### The 13 Core Ottavino Architecture Types

Ottavino structures its VM using 13 primary Rust types:

1. **`Lua`**: The top-level Lua VM instance owning the garbage collector arena.
2. **`Context<'gc>`**: GC mutation handle and string interning context passed into inner VM operations.
3. **`Executor`**: Trampoline VM runner that executes bytecode instructions step-by-step.
4. **`StashedExecutor`**: Arena-safe reference handle holding an executor across `Lua::enter` calls.
5. **`Value<'gc>`**: Core tagged union enum representing all Lua values (`Nil`, `Boolean`, `Integer`, `Number`, `String`, `Table`, `Function`, `Thread`, `UserData`).
6. **`Table<'gc>`**: GC-managed hash/array associative data structure.
7. **`Closure<'gc>`**: Compiled Lua bytecode function prototype bound to environment upvalues.
8. **`Fuel`**: Step counter object pacing execution time.
9. **`Callback<'gc>`**: Rust host function callback implementing `CallbackFn` or `Sequence`.
10. **`Thread<'gc>`**: Coroutine thread object representing an execution stack.
11. **`Stack<'gc>`**: Value stack holding function arguments and return values.
12. **`UserData<'gc>`**: Host custom raw data buffer.
13. **`Metrics`**: GC allocator metrics snapshot.

### A "Stackless" Interpreter Design

In standard PUC-Rio Lua (and C implementations), evaluating Lua code relies on the host C call stack. When Lua calls a C function, which calls a Lua function, which yields, the C stack frames must remain alive or be unwound.

Ottavino/Piccolo uses a **stackless** (or trampoline) VM architecture:
- Execution state is reified into an explicit `Executor` struct on the heap rather than relying on the host Rust/C call stack.
- Long-running execution is driven externally through polling (`Executor::step`).
- At any point between step evaluations, execution can be paused, suspended, or interrupted.

### Benefits of Stackless Architecture

#### 1. Cancellation
Because execution is driven by polling from the host, an infinite loop in untrusted Lua code (`while true do end`) does not lock up the host application or native call stack. The host caller can simply stop polling `Executor::step` or drop the executor.

#### 2. Pre-emptive Concurrency & Tasklets
Standard Lua coroutines are cooperative—a running script must explicitly call `coroutine.yield()`. In Ottavino, because the interpreter step function returns control after a bounded amount of fuel/steps, the host can run multiple independent Lua threads/tasklets pre-emptively in a round-robin schedule without requiring cooperation from the scripts.

#### 3. Fuel, Pacing, and Custom Scheduling
Ottavino tracks VM execution using a **`Fuel`** counter:
- As the VM executes bytecode instructions, fuel is consumed.
- When fuel is exhausted or an explicit interrupt occurs, `Executor::step` yields control back to the host caller.
- This allows host applications (e.g. game loops or web servers) to allocate a bounded CPU slice ("fuel allowance") per frame/request to untrusted Lua scripts.

#### 4. "Symmetric" Coroutines and `coroutine.yieldto`
Standard Lua supports *asymmetric* coroutines (`coroutine.resume` yields back *only* to its direct caller). Supporting true *symmetric* coroutines (yielding directly to another sibling coroutine) in standard Lua causes stack leaks because standard Lua cannot perform "tail yields".

In Ottavino, because control flow jumps back to the trampoline executor loop, symmetric coroutines are natively supported via **`coroutine.yieldto(co, ...)`**:

```lua
-- Symmetric coroutine hand-off without stack leaks or external runner loops
co1 = coroutine.create(function()
  while true do
    print("In co1, handing off to co2")
    coroutine.yieldto(co2)
  end
end)

co2 = coroutine.create(function()
  while true do
    print("In co2, handing off to co1")
    coroutine.yieldto(co1)
  end
end)

coroutine.resume(co1)
```

### The "Big Lie" (Comparison with PUC-Rio C-Lua & `lua_callk`)

In standard PUC-Rio Lua C API, tasklets can be approximated using `lua_sethook` with instruction count triggers that call `lua_yield`. However, if Lua calls a C function (like `table.sort`) which in turn calls a Lua comparator function, calling `lua_yield` inside the comparator causes a C `longjmp` failure (`LUA_ERRRUN` / "attempt to yield across C-call boundary").

While PUC-Rio Lua introduced `lua_callk` / `lua_pcallk` to allow C functions to specify continuation functions for yielding, writing C callbacks this way is notoriously complex and error-prone. Almost none of the standard C library functions support continuation yielding.

Ottavino solves this at the root: **all** VM instruction loops, closures, and stdlib operations are structured around step continuation objects (`Sequence`), making the entire VM stackless and yieldable by design.

### Rust Coroutines, Lua Coroutines, and Snarfing

In programming language theory, **"snarfing"** occurs when an embedded guest language automatically inherits features from its host language (such as memory management or execution state).

Ottavino was designed so that Lua execution mechanics mesh cleanly with Rust's ownership and async/coroutine models. Instead of relying on unsafe C stack manipulations, execution state is held in safe Rust data structures.

### Arena Memory Allocation & GC (`gc-arena`)

Ottavino uses [`gc-arena`](https://github.com/kyren/gc-arena) for garbage collection:
- **Mutation XOR Collection**: Memory access occurs within safe GC mutation blocks.
- **Pure Rust Safety**: Provides true tracing garbage collection in safe Rust without relying on global GC locks or unsafe C pointers.
- **Memory Metrics**: Exposes `totalMemory()`, `gcCollect()`, and `gcMetrics()` to JavaScript.

### Sandboxing & Modular Library Loading

To ensure maximum security when running untrusted user scripts, Ottavino omits unsafe host modules present in standard C-Lua:
- **No `package` / `require`**: Prevents loading arbitrary host files or external C dynamic libraries.
- **No `os` module**: Eliminates shell execution (`os.execute`) or unsafe filesystem mutation.
- **No `debug` module**: Prevents inspecting internal stack frames or upvalues.

Furthermore, library loading is granular:
- `Lua.empty()` starts with zero stdlib functions.
- `loadCore()` loads `base`, `coroutine`, `math`, `string`, and `table`.
- `loadIo()` loads `io`.
