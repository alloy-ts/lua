# Lua Language Guide & Standard Library Reference

This guide covers the fundamentals of the **Lua 5.4** scripting language, its standard library modules, and the specific architecture and capabilities provided by **`ottavino`** (the pure Rust Lua 5.4 implementation driving this NAPI addon).

---

## 1. Lua 5.4 Language Basics

Lua is a lightweight, embeddable, dynamically typed scripting language.

### Variables & Data Types
Lua has eight basic primitive types:
- **`nil`**: Represents the absence of a value.
- **`boolean`**: `true` or `false`.
- **`number`**: Double-precision floating-point numbers or 64-bit signed integers (introduced in Lua 5.3+).
- **`string`**: Immutable byte sequences.
- **`table`**: Associative arrays used as objects, dictionaries, lists, and namespaces.
- **`function`**: First-class functions.
- **`thread`**: Coroutines for cooperative multitasking.
- **`userdata`**: Arbitrary host-language data structures.

```lua
-- Global vs Local variables
local count = 42          -- Integer number
local name = "Ottavino"   -- String
local isActive = true     -- Boolean
local empty = nil         -- Nil

globalVar = "accessible globally"
```

### Control Flow
```lua
-- Conditionals
if count > 50 then
  print("High count")
elseif count == 42 then
  print("Answer to everything")
else
  print("Low count")
end

-- Loops
for i = 1, 5 do
  -- Numeric for loop from 1 to 5
end

while isActive do
  isActive = false
end
```

### Tables (Objects & Arrays)
Tables are the only data structuring mechanism in Lua:
```lua
-- Dictionary / Object
local user = {
  id = 1,
  name = "Alice",
  role = "Admin"
}
print(user.name)       -- "Alice"
user.role = "SuperAdmin"

-- Array / List (1-indexed in Lua standard)
local colors = {"red", "green", "blue"}
print(colors[1])       -- "red"
```

### Functions
Functions in Lua are first-class values with full lexical scoping and closures:
```lua
local function add(a, b)
  return a + b
end

local multiply = function(a, b)
  return a * b
end
```

---

## 2. Lua 5.4 Standard Library

When running in `Lua.full()` or `Lua.core()` modes, standard library modules are preloaded into global variables:

| Module | Available In | Description |
| :--- | :--- | :--- |
| **Base** | `core`, `full` | Core globals: `print`, `type`, `tostring`, `tonumber`, `assert`, `error`, `select`, `pcall`, `xpcall`, `pairs`, `ipairs`, `next`, `getmetatable`, `setmetatable`. |
| **`math`** | `core`, `full` | Math utilities: `math.abs`, `math.sqrt`, `math.floor`, `math.ceil`, `math.sin`, `math.cos`, `math.max`, `math.min`, `math.random`, `math.pi`, etc. |
| **`string`** | `core`, `full` | String manipulation: `string.upper`, `string.lower`, `string.sub`, `string.len`, `string.format`, `string.find`, `string.match`, `string.gmatch`, `string.gsub`. |
| **`table`** | `core`, `full` | Table manipulation: `table.insert`, `table.remove`, `table.concat`, `table.sort`, `table.move`, `table.unpack`, `table.pack`. |
| **`coroutine`** | `core`, `full` | Cooperative multitasking: `coroutine.create`, `coroutine.resume`, `coroutine.yield`, `coroutine.status`, `coroutine.wrap`, `coroutine.running`, `coroutine.isyieldable`. |
| **`io`** | `full` | I/O file operations (`io.open`, `io.read`, `io.write`, `io.flush`, `io.close`). |

---

## 3. What `ottavino` Adds

**`ottavino`** is a Rust implementation of the Lua 5.4 VM. It differs from standard C-Lua (`PUC-Rio Lua`) in several key ways:

### Memory Safety & Deterministic Garbage Collection (`gc-arena`)
- Built on `gc-arena`, a branded garbage-collection arena that provides memory safety guarantees in safe Rust.
- Prevents dangling pointers across native boundaries and tracks precise allocation sizes (`Lua::total_memory()`, `Lua::gc_metrics()`).

### Sandboxing & Fine-Grained Library Control
`ottavino` separates standard library initialization into isolated, modular tiers:
- **`Lua.empty()`**: Zero standard library modules loaded. Secure sandbox suitable for evaluating untrusted arithmetic expressions without side effects.
- **`Lua.core()`**: Pure computationally safe standard library preloaded (`math`, `string`, `table`, `coroutine`, base functions) without system file/device I/O access.
- **`Lua.full()`**: Full Lua environment including I/O access (`io`).

### Bounded Execution / Fuel Mechanism
- `ottavino` uses a **Fuel** counter in the interpreter loop (`Fuel::with(fuel_amount)`).
- Interrogates and bounds VM step execution to prevent infinite loop script attacks (`while true do end`).

### Stashed Native Handles
- Provides safe, branded handle stashing (`StashedExecutor`, `StashedTable`, `StashedClosure`) so host applications (such as Node.js NAPI) can retain references across garbage collection cycles safely.
