# Lua 5.4 & Ottavino (Piccolo) Language Guide

This guide covers Lua 5.4 language basics, the standard library provided by **Ottavino** (a fork of _Piccolo_), its unique **stackless interpreter design**, and **cross-boundary exception conversion**.

---

## 1. Lua 5.4 Language Basics

Lua is a lightweight, dynamically typed scripting language designed for embedding into host environments like JavaScript and Node.js.

### Types & Literals

- **`nil`**: Represents absence of value (maps to JS `undefined` or `null`).
- **`boolean`**: `true` or `false`.
- **`number`**: Double-precision floating-point numbers or 64-bit signed integers.
- **`string`**: Immutable sequences of bytes or UTF-8 text.
- **`table`**: The fundamental associative data structure (combines hash maps and arrays).
- **`function`**: First-class closures and functions.
- **`userdata`**: Host-managed custom memory pointers.
- **`thread`**: Coroutines for cooperative multitasking.

### Variables & Scope

```lua
-- Global variables (accessible across the execution context)
globalVar = 42

-- Local variables (lexically scoped)
local name = "Alice"

-- Lua 5.4 Constants (<const> attribute)
local MAX_RETRIES <const> = 5
```

---

## 2. Standard Library Overview

Ottavino provides a modular standard library:

### Base Library

Core functions implicitly available in global scope:

- **Type Checking & Conversion**: `type()`, `tostring()`, `tonumber()`
- **Assertions & Errors**: `assert()`, `error()`, `pcall()` (protected call), `xpcall()`
- **Metatables**: `getmetatable()`, `setmetatable()`, `rawget()`, `rawset()`, `rawequal()`
- **Iteration**: `pairs()` (hash map key-values), `ipairs()` (1-indexed array elements), `next()`

### Math Library (`math`)

- **Trigonometry**: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`, `math.deg`, `math.rad`
- **Rounding & Bounds**: `math.floor`, `math.ceil`, `math.fmod`, `math.abs`, `math.max`, `math.min`, `math.sqrt`
- **Constants**: `math.pi`, `math.huge` ($\infty$), `math.maxinteger`, `math.mininteger`

### String Library (`string`)

- `string.len`, `string.lower`, `string.upper`, `string.format`, `string.rep`, `string.reverse`, `string.sub`, `string.find`, `string.match`, `string.gmatch`, `string.gsub`, `string.pack`, `string.unpack`

### Table Library (`table`)

- `table.insert()`, `table.remove()`, `table.move()`, `table.sort()`, `table.concat()`, `table.pack()`, `table.unpack()`

### Coroutine Library (`coroutine`)

- `coroutine.create()`, `coroutine.resume()`, `coroutine.yield()`, `coroutine.status()`, `coroutine.wrap()`, `coroutine.yieldto()`

---

## 3. Cross-Boundary Exception Conversion & Error Handling

Errors flow seamlessly between JavaScript/TypeScript and Lua across the NAPI boundary:

```
[JavaScript/TypeScript] <======= NAPI Bridge ======> [Lua VM / Ottavino]
   try / catch (err)     <-- Lua error converted --     error("msg")
   throw new Error()     -- JS error converted  -->   pcall() / error
```

### 1. Lua Errors -> JavaScript Exceptions

When a Lua script throws a runtime error (`error("message")`) or fails parsing due to a syntax error, Ottavino's runtime error is converted into a native JavaScript `Error` exception:

```ts
try {
  lua.eval("error('Explicit Lua runtime error!')");
} catch (err: any) {
  console.log(err.message); // "lua error: Explicit Lua runtime error!"
}
```

### 2. JavaScript Callback Errors -> Lua Runtime Errors

When a registered host JavaScript function (`registerCallback`) throws an exception during execution, NAPI catches the exception and converts it into an `ottavino::RuntimeError` inside the VM stack:

```ts
lua.registerCallback("validateValue", (val: number) => {
  if (val < 0) throw new Error("Negative value not allowed!");
  return val;
});

// Inside Lua, pcall() can catch the converted JS error
const result = lua.eval(`
  local ok, err = pcall(function() return validateValue(-10) end)
  return { ok = ok, err = err }
`);
```

### 3. Unhandled Callback Error Propagation

If a JS callback error is thrown and Lua does _not_ handle it with `pcall`, the exception propagates all the way back out through `lua.eval()` as a JavaScript exception.

---

## 4. Ottavino (Piccolo) Architecture & Stackless Interpreter Design

Ottavino is a pure-Rust implementation of Lua 5.4 derived from _Piccolo_.

### A "Stackless" Interpreter Design

Unlike standard C-based Lua (PUC-Rio Lua) which relies on the host C call stack for execution frames, Ottavino uses a **stackless (trampoline) interpreter design**.

- Execution state is reified into explicit Rust objects (`Executor`, `Thread`, `Stack`) rather than relying on the native Rust function call stack.
- Long-running Lua execution is driven from the outside by stepping/polling in a loop.

### Benefits of the Stackless Design

#### 1. Cancellation

Because execution state lives in heap-allocated VM structures rather than on the Rust call stack, running scripts can be safely canceled at any point without leaking native memory or corrupting host state simply by dropping or stopping polling on the `Executor`.

#### 2. Pre-emptive Concurrency

Multiple Lua execution tasklets can be multiplexed in a round-robin schedule across JavaScript/Host event loops. Even without explicit `coroutine.yield()` statements in Lua code, time-slicing allows multiple scripts to execute concurrently without blocking the host process.

#### 3. Fuel, Pacing, and Custom Scheduling

Execution is bounded by **Fuel**. Each VM instruction or callback step consumes fuel. When fuel is exhausted, execution pauses safely and control yields back to the host, preventing infinite loops in untrusted scripts.

#### 4. Symmetric Coroutines and `coroutine.yieldto`

Standard Lua supports _asymmetric coroutines_ (yielding control only back to the direct caller). Ottavino's stackless architecture enables **symmetric coroutines** via `coroutine.yieldto(co)`, yielding control directly to another coroutine without accumulating stack frames or causing stack leaks.

---

## 5. The "Big Lie" & C API Limitations vs. Stackless Rust

In PUC-Rio Lua, yielding from nested C callbacks (a "Lua -> C -> Lua" sandwich like `table.sort` with a Lua comparator) requires complex `lua_callk` / `lua_yieldk` continuation functions because a C `longjmp` destroys the C stack. Most C stdlib functions cannot be safely yielded across.

Ottavino solves this at the architecture level:

- Every callback or closure execution is reified into a step-based sequence.
- All standard library calls—even those invoking Lua metamethods or callbacks—are fully suspendable and resumeable across the host FFI boundary.

---

## 6. Rust Coroutines, Lua Coroutines, and Snarfing

- **Snarfing**: Incorporating semantics from the host language into the inner embedded language.
- Ottavino uses `gc-arena` for garbage collection isolation and reifies VM call frames so that Lua garbage collection can take place safely between `enter` mutator calls when no GC pointers exist on the Rust stack.

---

## 7. Zooming Out: Safety, Isolation, and Sandboxing

- **Multiple Isolated VMs**: Multiple `Lua` instances can run concurrently in the same Node.js process without shared global state.
- **Sandboxing**: By choosing between `Lua.empty()`, `Lua.core()`, and `Lua.full()`, host applications can completely strip file I/O or system access for untrusted script execution.
