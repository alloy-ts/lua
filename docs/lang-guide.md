# Lua 5.4 & Ottavino / Piccolo Language & Architecture Guide

This document covers **Lua 5.4** language fundamentals, standard library features, and the architecture of **Piccolo / Ottavino**—the pure-Rust, stackless interpreter driving `@alloy-ts/lua`.

---

## Table of Contents

- [1. Lua 5.4 Basics](#1-lua-54-basics)
- [2. Metatables & Metamethods](#2-metatables--metamethods)
- [3. Standard Library Overview](#3-standard-library-overview)
- [4. The Architecture of Piccolo / Ottavino](#4-the-architecture-of-piccolo--ottavino)
  - [A "Stackless" Interpreter Design](#a-stackless-interpreter-design)
  - [Benefits of Stackless](#benefits-of-stackless)
    - [Cancellation](#cancellation)
    - [Pre-emptive Concurrency](#pre-emptive-concurrency)
    - [Fuel, Pacing, and Custom Scheduling](#fuel-pacing-and-custom-scheduling)
    - ["Symmetric" Coroutines and `coroutine.yieldto`](#symmetric-coroutines-and-coroutineyieldto)
  - [The "Big Lie" & PUC-Rio C API vs Stackless Rust](#the-big-lie--puc-rio-c-api-vs-stackless-rust)
  - [Rust Coroutines, Lua Coroutines, and Snarfing](#rust-coroutines-lua-coroutines-and-snarfing)
  - [Zooming Out: Sandboxing & Systems Programming](#zooming-out-sandboxing--systems-programming)

---

## 1. Lua 5.4 Basics

### Primitives & Value Types
Lua 5.4 features eight fundamental types:
- **`nil`**: Represents absence of value (`null`/`undefined` in JS).
- **`boolean`**: `true` or `false`.
- **`number`**: 64-bit signed integers (`integer`) and 64-bit IEEE-754 floats (`float`).
- **`string`**: Immutable byte sequences or UTF-8 text.
- **`table`**: Associative arrays (used for objects, arrays, maps, and namespaces).
- **`function`**: First-class closures.
- **`thread`**: Coroutines for cooperative execution.
- **`userdata`**: Host-managed structures.

### Variables & Lua 5.4 `<const>`
```lua
-- Global Variable
globalVar = 42

-- Local Variable
local localVar = "hello"

-- Block-Scoped Constant (Lua 5.4)
local MAX_LIMIT <const> = 100
-- MAX_LIMIT = 200 -- Throws compile error: attempt to assign to const variable
```

---

## 2. Metatables & Metamethods

Metatables customize table behavior:
- `__index`: Fallback table or function when reading missing keys.
- `__newindex`: Intercepts assignments to missing keys (used for read-only tables / global constants).
- `__add`, `__sub`, `__concat`, `__tostring`: Operator overloading.

---

## 3. Standard Library Overview

| Module | Core Functions |
|---|---|
| **Base** | `print`, `type`, `assert`, `error`, `pcall`, `xpcall`, `pairs`, `ipairs`, `rawget`, `rawset`, `setmetatable`, `getmetatable` |
| **Math** | `math.abs`, `math.floor`, `math.ceil`, `math.max`, `math.min`, `math.sqrt`, `math.type` |
| **String** | `string.upper`, `string.lower`, `string.sub`, `string.format`, `string.match`, `string.gsub` |
| **Table** | `table.insert`, `table.remove`, `table.sort`, `table.concat`, `table.pack`, `table.unpack` |
| **Coroutine** | `coroutine.create`, `coroutine.resume`, `coroutine.yield`, `coroutine.status`, `coroutine.yieldto` |

---

## 4. The Architecture of Piccolo / Ottavino

### A "Stackless" Interpreter Design

Traditional language VM interpreters (such as standard PUC-Rio Lua in C) rely on the host C call stack for execution state. In contrast, **Piccolo** (and Ottavino) uses a **stackless** (trampoline) interpreter design.

The execution state of a running Lua thread is reified into an `Executor` object that does not rely on the Rust function call stack. Execution progress is driven by polling:

```rust
loop {
    if executor.step(ctx, &mut fuel) {
        break; // Execution completed
    }
    // Execution suspended; control returned safely to host
}
```

This design guarantees that execution can be suspended at any instruction boundary, allowing `gc-arena` garbage collection to take place without un-tracked references on the host stack.

---

### Benefits of Stackless

#### Cancellation
Because execution is driven by explicit polling steps, cancelling an untrusted script is trivial: stop calling `.step()` and drop the executor. Memory and GC resources are freed safely without risking incomplete stack unwinding.

#### Pre-emptive Concurrency
While standard Lua coroutines only offer *cooperative* multitasking, Piccolo's stackless executor allows *pre-emptive* concurrency. By stepping multiple `Executor` tasklets in round-robin fashion, multiple independent Lua scripts can run concurrently over shared global state without blocking each other.

#### Fuel, Pacing, and Custom Scheduling
Each execution step consumes a unit of execution budget called **`Fuel`**.
- Scripts are bounded by their allocated fuel per slice.
- Badly written or infinite loops (`while true do end`) cannot freeze host applications or the JavaScript event loop.
- Host callbacks can interrupt fuel flow to yield control instantly to event loops (e.g., UI rendering or server event handling).

#### "Symmetric" Coroutines and `coroutine.yieldto`
Standard Lua features *asymmetric* coroutines (`coroutine.resume` / `coroutine.yield`), which can only yield back to their immediate caller. Achieving mutual yields between coroutines without accumulating stack frames requires complex outer runner wrappers in traditional Lua.

Piccolo natively supports **symmetric coroutines** via `coroutine.yieldto(target_thread)`:
```lua
-- Directly yield control to another thread without stack leakage (tail yield)
coroutine.yieldto(targetCoroutine)
```

---

### The "Big Lie" & PUC-Rio C API vs Stackless Rust

Standard PUC-Rio Lua C API can achieve basic instruction interrupts via `lua_sethook` and `lua_yield`. However, **the "Big Lie"** is that traditional C Lua breaks when a yield occurs inside nested C callbacks (a "Lua $\rightarrow$ C $\rightarrow$ Lua" sandwich).

In traditional C Lua, resolving yields inside callbacks requires rewriting C code using `lua_callk` / `lua_pcallk` and continuation functions. Because writing C continuations manually is extraordinarily difficult, standard C stdlib functions (like `table.sort` with a custom comparator) cannot safely yield.

Piccolo solves this natively in safe Rust by structuring all VM frames and callbacks as polling state machines (`Sequence`), making nested callbacks fully suspendable without C-style `longjmp` fragility.

---

### Rust Coroutines, Lua Coroutines, and Snarfing

**Snarfing** is a programming language concept where an embedded language automatically inherits ("snarfs") features from its host implementation language.
- Standard Lua snarfs host C memory allocation and locale handling.
- Piccolo uses `gc-arena` for garbage collection and aligns sequence polling with Rust's `Future` / `Coroutine` state machine model.

---

### Zooming Out: Sandboxing & Systems Programming

Piccolo and Ottavino bring true safe sandboxing to embedded scripting:
- **No unsafe C memory management**: Eliminates buffer overflows or memory safety exploits from untrusted Lua code.
- **Multi-tenant VM isolation**: You can instantiate as many isolated `Lua` instances as needed.
- **Unobtrusive Embedded Scripting**: Offers total control over fuel, scheduling, standard library sandboxing (`Lua.empty()`, `Lua.core()`, `Lua.full()`), and memory usage.
