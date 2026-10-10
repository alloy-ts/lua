# Lua 5.4 & Ottavino Language Guide

This guide provides an overview of **Lua 5.4** language basics, standard libraries, and how the **Ottavino** pure-Rust VM executes Lua in JavaScript/Node.js environments.

---

## 1. Lua 5.4 Syntax & Language Basics

### Primitives & Types
Lua has eight basic types:
- `nil`: Represents absence of value (`null`/`undefined` in JS).
- `boolean`: `true` or `false`.
- `number`: Represents both 64-bit integers (`integer`) and 64-bit floating-point numbers (`float`).
- `string`: Immutable sequences of bytes or UTF-8 characters.
- `table`: The sole data-structuring mechanism in Lua (associative array).
- `function`: First-class closures.
- `thread`: Coroutines for cooperative multitasking.
- `userdata`: Custom C/Rust host structures.

### Variables & Block-Scoped Constants
- Global variables: Created by default unless declared `local`.
  ```lua
  globalVar = 100
  ```
- Local variables: Declared with `local`.
  ```lua
  local count = 1
  ```
- Local constants (Lua 5.4 feature): Declared with `<const>` attribute.
  ```lua
  local MAX_RETRY <const> = 5
  -- MAX_RETRY = 10 -- Throws compile error: attempt to assign to const variable
  ```

### Control Flow
```lua
-- Conditional Statements
if x > 10 then
  print("greater")
elseif x == 10 then
  print("equal")
else
  print("lesser")
end

-- Numeric For Loop
for i = 1, 5, 1 do
  print(i)
end

-- Generic For Loop (Pairs & Ipairs)
for key, val in pairs({ a = 1, b = 2 }) do
  print(key, val)
end
```

---

## 2. Metatables & Object-Oriented Programming

Metatables allow customizing Lua table behavior using metamethods:
- `__index`: Invoked when querying a non-existent key.
- `__newindex`: Invoked when assigning to a non-existent key (useful for read-only tables or proxy tables).
- `__add`, `__sub`, `__tostring`, `__gc`: Operator overloading and object lifecycle customization.

---

## 3. What is in the Lua Standard Library?

Lua 5.4 includes core standard libraries:

| Library | Modules & Functions |
|---|---|
| **Base** | `print`, `type`, `assert`, `error`, `pcall`, `xpcall`, `select`, `tonumber`, `tostring`, `pairs`, `ipairs`, `rawget`, `rawset`, `setmetatable`, `getmetatable` |
| **Math** | `math.abs`, `math.floor`, `math.ceil`, `math.max`, `math.min`, `math.sqrt`, `math.random`, `math.type` (`"integer"` vs `"float"`) |
| **String** | `string.upper`, `string.lower`, `string.sub`, `string.format`, `string.match`, `string.gsub`, `string.len` |
| **Table** | `table.insert`, `table.remove`, `table.sort`, `table.concat`, `table.pack`, `table.unpack` |
| **Coroutine** | `coroutine.create`, `coroutine.resume`, `coroutine.yield`, `coroutine.status`, `coroutine.running` |

---

## 4. What Does Ottavino Provide?

**Ottavino** is a pure-Rust VM implementation of Lua 5.4:

1. **Pure Rust Execution**: Eliminates C dependencies, memory unsafe C pointers, and native compilation toolchain requirements on client machines.
2. **Garbage Collection (GC Arena)**: Provides fine-grained GC tracking and metrics through `ottavino-gc-arena` integrated with NAPI.
3. **Sandboxing Control**: Allows selective loading of standard libraries (`Lua.empty()`, `Lua.core()`, `Lua.full()`, `loadCore()`, `loadIo()`) to restrict VM access in safe sandboxed environments.
4. **Seamless NAPI Interop**: Converts JS primitives, plain `Object`s, and `Array`s bi-directionally to Lua primitive values and tables.
