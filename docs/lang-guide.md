# `@alloy-ts/lua` Language Guide (Lua 5.4 & Ottavino)

This guide covers the Lua 5.4 programming language basics, standard libraries supported by `@alloy-ts/lua`, and specific features and extensions provided by the **Ottavino** pure-Rust VM engine.

---

## 1. Lua 5.4 Basics

Lua is a lightweight, dynamically-typed scripting language designed for embedding into host applications.

### 1.1 Data Types

Lua has eight basic types:

| Type       | Description                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `nil`      | Represents the absence of a value (equivalent to JS `undefined`/`null`).                       |
| `boolean`  | `true` or `false`. (Note: in Lua, only `false` and `nil` are falsy; `0` and `""` are truthy!). |
| `number`   | Double-precision floats or 64-bit signed integers (`42` vs `3.14`).                            |
| `string`   | Immutable sequence of bytes.                                                                   |
| `table`    | Associative array used for objects, arrays, dictionaries, and sets.                            |
| `function` | First-class function value or closure.                                                         |
| `userdata` | Opaque memory blocks managed by host bindings.                                                 |
| `thread`   | Represents an independent coroutine / execution thread.                                        |

### 1.2 Variables & Scope

Variables in Lua are global by default unless explicitly declared with `local`:

```lua
local name = "Alice" -- Local variable (scoped to block)
score = 100          -- Global variable
```

### 1.3 Control Flow

#### Conditionals

```lua
if score >= 100 then
  print("High score!")
elseif score > 50 then
  print("Good job")
else
  print("Keep trying")
end
```

#### Numeric `for` Loop

```lua
for i = 1, 5, 1 do -- start, stop, step
  print(i)
end
```

#### Generic `for` Loop (`pairs` and `ipairs`)

```lua
-- Array iteration (1-indexed)
local items = { "apple", "banana", "cherry" }
for index, value in ipairs(items) do
  print(index, value)
end

-- Key-value object iteration
local user = { name = "Bob", role = "Admin" }
for key, value in pairs(user) do
  print(key, value)
end
```

#### `while` and `repeat-until` Loops

```lua
local count = 3
while count > 0 do
  count = count - 1
end

repeat
  count = count + 1
until count == 3
```

---

### 1.4 Functions

Functions are first-class values in Lua:

```lua
-- Named function
function add(a, b)
  return a + b
end

-- Anonymous function
local multiply = function(a, b)
  return a * b
end

-- Multiple return values
function getMinMax(a, b)
  if a < b then
    return a, b
  else
    return b, a
  end
end

local min, max = getMinMax(10, 5)
```

---

### 1.5 Tables & Object-Oriented Patterns

Tables are Lua's single data-structuring mechanism:

```lua
-- Array (1-indexed)
local arr = { 10, 20, 30 }
table.insert(arr, 40)
print(arr[1]) -- 10

-- Dictionary / Object
local player = {
  name = "Aria",
  hp = 100,
}

-- Method syntax (syntactic sugar for self parameter)
function player:takeDamage(amount)
  self.hp = self.hp - amount
end

player:takeDamage(20) -- Equivalent to player.takeDamage(player, 20)
```

---

## 2. Standard Libraries in `@alloy-ts/lua`

When initializing a state with `Lua.full()` or loading core libraries via `lua.loadCore()`, the following standard libraries are provided:

### 2.1 Base Library

Core global functions available in the environment:

- `print(...)`: Outputs text to console stdout.
- `type(v)`: Returns type name string (`"number"`, `"string"`, `"table"`, `"function"`, etc.).
- `assert(v [, message])`: Raises error if `v` is falsy.
- `error(message)`: Raises runtime execution error.
- `pcall(f, ...)` / `xpcall(f, msgh)`: Protected function calls for error handling.
- `select(index, ...)`: Returns items in varargs list starting at `index`.
- `pairs(t)` / `ipairs(t)` / `next(t)`: Table iterators.
- `tostring(v)` / `tonumber(v)`: Explicit type conversion.
- `setmetatable(t, mt)` / `getmetatable(t)`: Metatable management.
- `rawget(t, k)` / `rawset(t, k, v)`: Table access bypassing metamethods.
- `collectgarbage([opt])`: Trigger memory garbage collection.

### 2.2 Math Library (`math`)

Functions and mathematical constants:

- **Constants:** `math.pi`, `math.huge` ($\infty$), `math.maxinteger`, `math.mininteger`.
- **Functions:** `math.abs`, `math.acos`, `math.asin`, `math.atan`, `math.ceil`, `math.cos`, `math.deg`, `math.exp`, `math.floor`, `math.fmod`, `math.log`, `math.max`, `math.min`, `math.modf`, `math.rad`, `math.random`, `math.randomseed`, `math.sin`, `math.sqrt`, `math.tan`, `math.tointeger`, `math.type`, `math.ult`.

### 2.3 String Library (`string`)

Pattern matching and string manipulation:

- `string.byte(s [, i [, j]])`, `string.char(...)`
- `string.find(s, pattern [, init [, plain]])`
- `string.format(formatstring, ...)`
- `string.gmatch(s, pattern)`, `string.gsub(s, pattern, repl)`
- `string.len(s)`, `string.lower(s)`, `string.upper(s)`
- `string.match(s, pattern)`
- `string.sub(s, i [, j])`, `string.rep(s, n)`, `string.reverse(s)`

### 2.4 Table Library (`table`)

Utilities for arrays and lists:

- `table.concat(list [, sep [, i [, j]]])`
- `table.insert(list, [pos,] value)`
- `table.remove(list [, pos])`
- `table.sort(list [, comp])`
- `table.move(a1, f, e, t [, a2])`
- `table.pack(...)`, `table.unpack(list [, i [, j]])`

### 2.5 Coroutine Library (`coroutine`)

Cooperative multitasking routines:

- `coroutine.create(f)`: Creates a new coroutine handle.
- `coroutine.resume(co [, val1, ...])`: Resumes or starts coroutine execution.
- `coroutine.yield(...)`: Suspends execution and returns values to caller.
- `coroutine.status(co)`: Returns status (`"running"`, `"suspended"`, `"normal"`, or `"dead"`).
- `coroutine.running()`: Returns the currently running coroutine handle.

---

## 3. What Ottavino Adds & Modifies

This library uses [Ottavino](https://github.com/kyren/ottavino), a pure Rust VM implementation of Lua 5.4.

### 3.1 Ottavino Coroutine Extensions

In addition to standard Lua 5.4 `coroutine` functions, Ottavino adds two extensions:

- `coroutine.yieldto(target_co, ...)`: Directly yields execution to another specific target coroutine without returning to the caller loop.
- `coroutine.continue(co)`: Resumes a suspended coroutine.

### 3.2 Pure Rust Memory Safety & GC

- **Incremental Mark-and-Sweep GC (`gc-arena`)**: Memory management in Ottavino uses the Rust `gc-arena` collector. This eliminates memory corruption, buffer overflows, and double-free bugs present in C-based VMs.
- **Real-Time Memory Metrics**: `lua.totalMemory()` and `lua.gcMetrics()` provide transparent visibility into allocator memory debt and total memory tracked by the VM.

### 3.3 Sandboxing & Isolation

- Unsafe C libraries (such as raw OS system calls or file handles) are isolated and sandboxed out by default.
- State is fully isolated per `Lua` instance, allowing multi-tenant execution in Node.js applications without global state pollution.
