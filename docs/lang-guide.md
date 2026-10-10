# Lua 5.4 Language & Standard Library Guide

This guide provides an overview of Lua 5.4 fundamentals, its standard library modules, and the architecture of the **Ottavino** (derived from Piccolo and `gc-arena`) pure-Rust Lua VM embedded in `@alloy-ts/lua`.

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
Cooperative multitasking, symmetric yielding, and resume controls:
* `coroutine.create(fn)`: Creates a new coroutine thread.
* `coroutine.resume(co, ...)`: Resumes execution of a coroutine until the next yield or return.
* `coroutine.yield(...)`: Suspends execution and yields values back to `resume`.
* `coroutine.yieldto(co, ...)`: **Symmetric Coroutine Yield:** Direct tail-yield to another target coroutine without stack frame leaks.
* `coroutine.status(co)`: Returns `"suspended"`, `"running"`, `"normal"`, or `"dead"`.

### I/O Library (`io`)
File operations and standard input/output streams:
* `io.write(...)`, `io.read(...)`, `io.open(filename, mode)`.

---

## 3. Ottavino (Piccolo) VM Architecture & Unique Capabilities

[Ottavino](https://github.com/kyren/ottavino) (a fork of Piccolo) is a pure-Rust, garbage-collected implementation of the Lua 5.4 VM. It introduces key architectural innovations that distinguish it from classical C Lua implementations.

### A "Stackless" Interpreter Design

Standard C Lua implementations (like PUC-Rio Lua) rely on the native C function call stack (`luaV_execute`, `lua_call`). This makes yielding from inside C callbacks difficult, as yielding across C frames relies on `longjmp`, which destroys stack frames.

In contrast, Ottavino utilizes a **"stackless" (trampoline style) VM loop**. Execution state is reified into VM objects polled by step loops (`Executor::step`). Control flow always returns back to the step executor.

```rust
// Pseudocode for stackless polling in Ottavino
loop {
    if executor.step(ctx, &mut fuel) {
        break; // Execution completed
    }
    // Execution suspended boundedly; safe to run GC or yield
}
```

### Key Benefits of the Stackless Design

#### 1. Cancellation
Because execution is polled step-by-step rather than taking over the thread stack, running scripts can be safely canceled at bounded instruction boundaries by dropping the executor, without unhandled stack unwinding or memory corruption.

#### 2. Pre-emptive Concurrency & Tasklets
Multiple Lua execution instances ("tasklets") can be multiplexed in round-robin fashion by polling each executor for a slice of "fuel". This achieves pre-emptive multitasking across Lua scripts without requiring scripts to cooperatively yield.

#### 3. Fuel, Pacing, and Custom Scheduling
Execution is paced using a `Fuel` budget. Host environments can allocate fuel quotas (e.g., per frame or per second) to limit CPU consumption by untrusted or looping Lua scripts.

#### 4. "Symmetric" Coroutines and `coroutine.yieldto`
Standard Lua coroutines are asymmetric (they yield only to their caller). Attempting to yield directly to another coroutine in standard C Lua causes stack frame accumulation (stack leak).

Because Ottavino's control flow is trampoline-based, it natively provides **symmetric coroutines** via `coroutine.yieldto(target_co, ...)`—enabling direct tail-yielding between coroutines without stack leaks.

```lua
-- Symmetric tail-yield between coroutines in Ottavino
coroutine.yieldto(other_coroutine, arg1, arg2)
```

### The "Big Lie": C Lua vs. Ottavino

In C Lua, yielding from nested C callbacks requires rewriting code with continuation functions (`lua_callk` / `lua_yieldk`), which is notoriously difficult to write safely due to `longjmp` stack unwinding. Ottavino solves this at the VM architecture level by managing all state through `gc-arena` ("Mutation XOR Collection" safe garbage collection) without C stack dependencies.

### Rust Coroutines, Lua Coroutines, and Snarfing

In programming language theory, **snarfing** refers to incorporating features from a host language directly into an embedded language implementation.

Standard C Lua cannot easily snarf stack constructs from C because C lacks native coroutines. In contrast, Ottavino's design uses `gc-arena` mutation arenas (`Context<'gc>`) to manage GC pointers safely on the heap rather than relying on host thread stack frames. This makes Lua execution in `@alloy-ts/lua` completely isolated, safe, and thread-resilient.
