# Lua 5.4 Language & Standard Library Guide

This guide provides an overview of Lua 5.4 language basics, the standard libraries included in this runtime, and the specific capabilities and extensions provided by the underlying pure-Rust **Ottavino** engine.

---

## 1. Lua 5.4 Language Basics

### Types and Variables
Lua is a dynamically typed language with eight basic types:
- **`nil`**: Represents non-existence or absence of value.
- **`boolean`**: `true` or `false`. (In conditional checks, only `false` and `nil` are falsey; `0` and `""` are truthy).
- **`number`**: Double-precision floats and 64-bit signed integers (Lua 5.4 differentiates integers and floats).
- **`string`**: Immutable byte sequences.
- **`table`**: Associative arrays used for objects, arrays, dictionaries, sets, and modules.
- **`function`**: First-class functions and closures.
- **`thread`**: Independent coroutines.
- **`userdata`**: Host-managed data structures.

### Variable Scope and Constants
- **Globals**: By default, assignment to an un-scoped variable sets a global variable (`x = 10`).
- **Locals**: Declared with `local` (`local name = "Lua"`).
- **Constants**: Lua 5.4 supports compile-time constants using `<const>`:
  ```lua
  local MAX_ITEMS <const> = 100
  ```

### Control Flow
```lua
if x > 10 then
  print("high")
elseif x < 0 then
  print("negative")
else
  print("normal")
end

-- Loops
for i = 1, 5 do
  print("Count: " .. i)
end

for key, value in pairs(myTable) do
  print(key, value)
end
```

---

## 2. Standard Libraries in Ottavino

[Ottavino](https://github.com/kyren/ottavino) is a pure-Rust, sandboxed implementation of Lua 5.4. To guarantee safety and memory isolation without C dependencies:
- It excludes host OS dependencies like raw file system I/O (`io` module) and unconstrained OS process execution (`os.execute`).
- It includes core sandboxed libraries: **Base**, **Math**, **String**, **Table**, and **Coroutine**.

### Base Library
Core global functions available in `Lua.full()` and `Lua.core()`:
- `assert(v, [message])`
- `error(message)`
- `type(v)`
- `tonumber(e, [base])`, `tostring(e)`
- `pairs(t)`, `ipairs(t)`, `next(t, [index])`
- `getmetatable(object)`, `setmetatable(table, metatable)`
- `pcall(f, ...)`
- `rawget(t, index)`, `rawset(t, index, value)`, `rawlen(v)`
- `select(index, ...)`
- `collectgarbage([opt], [arg])`

### Math Library (`math`)
Functions for numeric operations:
- Constants: `math.pi`, `math.huge`, `math.maxinteger`, `math.mininteger`
- Trigonometry: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`, `math.deg`, `math.rad`
- Rounding & Power: `math.floor`, `math.ceil`, `math.modf`, `math.fmod`, `math.abs`, `math.sqrt`, `math.exp`, `math.log`
- Random: `math.random`, `math.randomseed`
- Checks: `math.type`, `math.tointeger`, `math.ult`

### String Library (`string`)
String manipulation utilities:
- `string.len(s)`, `string.sub(s, i, [j])`, `string.rep(s, n)`
- `string.upper(s)`, `string.lower(s)`, `string.reverse(s)`
- `string.byte(s, [i], [j])`, `string.char(...)`
- `string.format(formatstring, ...)`
- Pattern matching: `string.find(s, pattern)`, `string.match(s, pattern)`, `string.gmatch(s, pattern)`, `string.gsub(s, pattern, repl)`

### Table Library (`table`)
Table manipulation utilities:
- `table.insert(list, [pos], value)`
- `table.remove(list, [pos])`
- `table.move(a1, f, e, t, [a2])`
- `table.concat(list, [sep], [i], [j])`
- `table.pack(...)`, `table.unpack(list, [i], [j])`
- `table.sort(list, [comp])`

### Coroutine Library (`coroutine`)
Coroutines enable cooperative multitasking and yielding generators:
- `coroutine.create(f)`
- `coroutine.resume(co, ...)`
- `coroutine.yield(...)`
- `coroutine.status(co)`
- `coroutine.running()`

---

## 3. What Ottavino Adds & Custom Extensions

In addition to standard Lua 5.4 features, Ottavino provides specific enhancements:

1. **Sandboxed Memory Management:**
   - Pure Rust generational GC (`ottavino-gc-arena`) with strict debt tracking and memory limits (`lua.totalMemory()`, `lua.gcMetrics()`).
2. **Extended Coroutine Primitives:**
   - `coroutine.yieldto(co, ...)`: Direct control transfer from one coroutine to another.
   - `coroutine.continue(co, ...)`: Coroutine continuation primitive.
3. **Safe JS/NAPI Integration:**
   - Direct round-trip conversion between JS primitives/objects/arrays and Lua tables without native C heap corruption or raw pointer risks.
