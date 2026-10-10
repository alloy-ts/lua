# Lua Language Guide & Ottavino VM Architecture

This guide covers the fundamentals of the **Lua 5.4** scripting language, its standard library modules, error handling mechanisms, and the internal architecture of **`ottavino`** (formerly Piccolo) — the pure Rust Lua 5.4 implementation powering this NAPI addon.

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

### Error Handling in Lua & JS Cross-Boundary
Lua provides built-in mechanisms for raising and trapping runtime errors:
- **`error(message)`**: Explicitly raises an error.
- **`assert(v, message)`**: Raises an error if `v` evaluates to false/nil.
- **`pcall(f, ...)`**: Protected call. Executes function `f` and returns `ok, result_or_error`.
- **`xpcall(f, msgh)`**: Protected call with custom error handler `msgh`.

When an error escapes a top-level Lua evaluation, the NAPI boundary intercepts the `ottavino::Error` and converts it into a standard JavaScript `Error` exception, allowing JS callers to handle Lua errors using standard `try { ... } catch (err) { ... }` blocks.

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

**`ottavino`** is a pure Rust implementation of the Lua 5.4 VM designed for safe sandboxing, memory safety, and resiliency.

### Stackless Interpreter & Execution Engine
Unlike standard C-Lua (PUC-Rio Lua) which relies on the native call stack, Ottavino utilizes a stackless execution model:
- Execution state is reified into an `Executor` state object driven by polling.
- Callbacks and VM execution steps do not lock the host call stack.
- Long-running scripts can be paused, bounded, or interrupted safely without C `longjmp` stack unwinding issues.

### Memory Safety & `gc-arena`
- Ottavino relies on `gc-arena` for garbage collection, providing compile-time memory safety guarantees in safe Rust.
- Memory usage is tracked accurately (`totalMemory()`, `gcMetrics()`), and garbage collection can be triggered explicitly (`gcCollect()`).

### Sandboxing & Fine-Grained Library Control
Ottavino provides modular initialization tiers for secure sandboxing:
- **`Lua.empty()`**: Zero standard library modules loaded. Ideal for evaluating untrusted arithmetic expressions with no environment access.
- **`Lua.core()`**: Preloaded with computationally safe standard library modules (`math`, `string`, `table`, `coroutine`, base functions), completely isolated from system file/network I/O.
- **`Lua.full()`**: Full Lua environment including I/O access (`io`).

### Bounded Execution & Fuel Pacing
- The interpreter loop uses a **Fuel** step counter (`Fuel::with(fuel_amount)`).
- Allows pacing and bounding script steps to prevent infinite loop attacks (`while true do end`).
