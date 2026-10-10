# Lua 5.4 Language & Standard Library Guide (with Ottavino)

This guide provides an overview of the Lua 5.4 language basics, its standard library components, and the specifics of the `ottavino` pure-Rust Lua implementation embedded in this NAPI library.

---

## 1. Lua 5.4 Syntax & Language Basics

### Comments
```lua
-- Single line comment

--[[
  Multi-line
  comment
--]]
```

### Variables & Dynamic Types
Lua has dynamic typing with 8 basic types: `nil`, `boolean`, `number` (integers and floats), `string`, `table`, `function`, `thread` (coroutine), and `userdata`.

```lua
local name = "Alice"     -- string
local age = 30           -- integer number
local pi = 3.14159       -- float number
local active = true      -- boolean
local data = nil         -- nil (represents absence of value)
```

### Operators
- **Arithmetic:** `+`, `-`, `*`, `/`, `//` (floor division), `%` (modulo), `^` (exponentiation)
- **Relational:** `==`, `~=` (not equal), `<`, `>`, `<=`, `>=`
- **Logical:** `and`, `or`, `not`
- **String Concatenation:** `..`
- **Length:** `#` (for strings and table sequences)

### Tables (Objects, Arrays, and Dictionaries)
Tables are the sole data-structuring mechanism in Lua:

```lua
-- Array-like table (1-indexed!)
local list = { "apple", "banana", "cherry" }
print(list[1]) -- "apple"

-- Key-value dictionary / Object
local person = {
  name = "Bob",
  age = 25
}
print(person.name) -- "Bob"
```

### Control Flow
```lua
-- If statement
if age >= 18 then
  print("Adult")
elseif age >= 13 then
  print("Teenager")
else
  print("Child")
end

-- Numeric For Loop
for i = 1, 5 do
  print(i)
end

-- Generic For Loop (Iterating over tables)
for k, v in pairs(person) do
  print(k, v)
end
```

### Functions & Closures
```lua
local function add(a, b)
  return a + b
end

local function makeAdder(amount)
  return function(x)
    return x + amount
  end
end

local add10 = makeAdder(10)
print(add10(5)) -- 15
```

---

## 2. Standard Libraries in Lua 5.4

Standard Lua 5.4 includes the following modules:

1. **Base Library (`base`):** `print`, `type`, `assert`, `error`, `pcall`, `xpcall`, `select`, `tostring`, `tonumber`, `getmetatable`, `setmetatable`, `rawget`, `rawset`, `pairs`, `ipairs`, `next`, `rawequal`.
2. **Coroutine Library (`coroutine`):** `create`, `resume`, `yield`, `status`, `running`, `isyieldable`, `wrap`.
3. **Math Library (`math`):** Trigonometric (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`), logarithmic (`log`, `exp`), rounding (`floor`, `ceil`), `min`, `max`, `abs`, `sqrt`, `random`, `randomseed`, `type`, `ult`, `tointeger`, `maxinteger`, `mininteger`, `pi`, `huge`.
4. **String Library (`string`):** `byte`, `char`, `dump`, `find`, `format`, `gmatch`, `gsub`, `len`, `lower`, `upper`, `match`, `rep`, `reverse`, `sub`, `pack`, `unpack`, `packsize`.
5. **Table Library (`table`):** `concat`, `insert`, `move`, `pack`, `remove`, `sort`, `unpack`.
6. **I/O & OS Libraries (`io`, `os`):** File handling (`io.open`, `io.read`, `io.write`), process environment, dates, times.

---

## 3. What Ottavino Adds & Provides

`ottavino` is a pure-Rust implementation of the Lua VM, designed for safety, memory efficiency, embeddability, and fine-grained GC control.

### What Ottavino Provides:
1. **Pure Rust Safety:** Executes Lua bytecode without C bindings or raw C pointers, isolating Lua execution completely within Rust's GC arena (`gc-arena`).
2. **Modular Sandboxing:**
   - **`Lua.empty()`:** Creates a state with zero standard library modules, ensuring a fully isolated, untrusted execution environment.
   - **`Lua.core()`:** Loads non-I/O modules (`base`, `coroutine`, `math`, `string`, `table`) while safely blocking filesystem and OS access.
   - **`Lua.full()`:** Loads all modules including `io`.
3. **Memory Inspection & Direct GC Control:**
   - **`totalMemory()`:** Exposes real-time byte count of allocated memory tracked by the GC arena allocator.
   - **`gcCollect()`:** Explicitly triggers garbage collection cycles on demand.
   - **`gcMetrics()`:** Exposes arena allocator metrics like `allocationDebt` and `totalAllocation`.
4. **Executor Architecture:**
   - Ottavino decouples thread/execution state using stashed handles (`Executor`), allowing coroutines, background execution, and fine-grained step control over running VM routines.
