# Lua Language Guide & Ottavino VM Architecture

This guide covers the fundamentals of the **Lua 5.4** scripting language, its standard library modules, and the architecture of **`ottavino`** (formerly Piccolo) — the pure Rust Lua 5.4 implementation powering this NAPI addon.

---

## 1. Lua 5.4 Language Basics

Lua is a lightweight, embeddable, dynamically typed scripting language.

### Variables & Primitive Types
Lua has eight basic primitive types:
- **`nil`**: Represents the absence of a value.
- **`boolean`**: `true` or `false`.
- **`number`**: Double-precision floating-point numbers or 64-bit signed integers.
- **`string`**: Immutable byte sequences.
- **`table`**: Associative arrays used as objects, dictionaries, lists, and namespaces.
- **`function`**: First-class lexical closures.
- **`thread`**: Coroutines for cooperative multitasking.
- **`userdata`**: Arbitrary host-language data structures.

```lua
local count = 42          -- Integer
local name = "Ottavino"   -- String
local isActive = true     -- Boolean
local empty = nil         -- Nil
```

### Control Flow & Tables
```lua
if count > 50 then
  print("High")
else
  print("Normal")
end

-- Tables as objects
local user = { id = 101, name = "Alice" }
user.role = "admin"

-- Tables as arrays (1-indexed in Lua standard)
local list = {"a", "b", "c"}
```

---

## 2. Lua 5.4 Standard Library Modules

When running in `Lua.full()` or `Lua.core()` modes, standard library modules are preloaded into global variables:

| Module | Available In | Description |
| :--- | :--- | :--- |
| **Base** | `core`, `full` | Core globals: `print`, `type`, `tostring`, `tonumber`, `assert`, `error`, `pcall`, `xpcall`, `pairs`, `ipairs`, `next`, `setmetatable`. |
| **`math`** | `core`, `full` | Math utilities: `math.abs`, `math.sqrt`, `math.floor`, `math.ceil`, `math.sin`, `math.cos`, `math.random`, `math.pi`. |
| **`string`** | `core`, `full` | String utilities: `string.upper`, `string.lower`, `string.sub`, `string.len`, `string.format`, `string.find`, `string.match`, `string.gsub`. |
| **`table`** | `core`, `full` | Table manipulation: `table.insert`, `table.remove`, `table.concat`, `table.sort`, `table.move`, `table.unpack`, `table.pack`. |
| **`coroutine`** | `core`, `full` | Cooperative multitasking: `coroutine.create`, `coroutine.resume`, `coroutine.yield`, `coroutine.status`, `coroutine.wrap`. |
| **`io`** | `full` | File I/O operations (`io.open`, `io.read`, `io.write`, `io.flush`, `io.close`). |

---

## 3. Ottavino / Piccolo VM Architecture

**`ottavino`** is a pure Rust implementation of the Lua 5.4 VM designed for safe sandboxing and resiliency.

### Stackless Interpreter Design
Unlike standard C-Lua (PUC-Rio Lua) which relies on the C function call stack, Ottavino uses a **stackless** (trampoline) interpreter design:
- Execution state is reified into an `Executor` state object that is driven by polling.
- Callbacks and script steps do not lock the Rust call stack.
- Long-running scripts can be paused, bounded, or interrupted without unwinding issues.

### Memory Safety & `gc-arena`
- Ottavino uses `gc-arena` for garbage collection, providing strict memory safety guarantees in safe Rust.
- Memory usage is tracked accurately (`totalMemory()`, `gcMetrics()`), and garbage collection can be triggered explicitly (`gcCollect()`).

### Sandboxing & Fine-Grained Library Control
Ottavino provides modular initialization tiers for secure sandboxing:
- **`Lua.empty()`**: Zero standard library modules loaded. Ideal for evaluating untrusted arithmetic expressions with no environment access.
- **`Lua.core()`**: Preloaded with computationally safe standard library modules (`math`, `string`, `table`, `coroutine`, base functions), completely isolated from system file/network I/O.
- **`Lua.full()`**: Full Lua environment including I/O access (`io`).

### Bounded Execution & Fuel Pacing
- The interpreter loop uses a **Fuel** step counter.
- Allows pacing and bounding script steps to prevent infinite loop attacks (`while true do end`).
