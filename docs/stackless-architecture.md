# Stackless Architecture & Interpreter Design Guide

A comprehensive architectural guide to stackless Lua interpreter design, comparing pure-Rust stackless VM execution (`ottavino` / `piccolo`) with traditional C-stack implementations, and detailing the benefits of pre-emptive concurrency, fuel pacing, symmetric coroutines, and sandboxing via NAPI.

---

## Table of Contents

- [1. A "Stackless" Interpreter Design](#1-a-stackless-interpreter-design)
  - [Reifying the Call Stack](#reifying-the-call-stack)
  - [The Trampoline VM Loop](#the-trampoline-vm-loop)
- [2. Benefits of Stackless Architecture](#2-benefits-of-stackless-architecture)
  - [Cancellation](#cancellation)
  - [Pre-emptive Concurrency & Tasklets](#pre-emptive-concurrency--tasklets)
  - [Fuel, Pacing, and Custom Scheduling](#fuel-pacing-and-custom-scheduling)
  - [Symmetric Coroutines & `coroutine.yieldto`](#symmetric-coroutines--coroutineyieldto)
- [3. The "Big Lie": Comparing with Traditional C-Stack Lua](#3-the-big-lie-comparing-with-traditional-c-stack-lua)
  - [The PUC-Rio C Stack Limit](#the-puc-rio-c-stack-limit)
  - [The Problem with C `longjmp` and `lua_callk`](#the-problem-with-c-longjmp-and-lua_callk)
- [4. Rust Coroutines, Lua Coroutines, and "Snarfing"](#4-rust-coroutines-lua-coroutines-and-snarfing)
  - [What is "Snarfing"?](#what-is-snarfing)
  - [Rust Futures & Lua Coroutines](#rust-futures--lua-coroutines)
- [5. Zooming Out: Embedded Language Philosophy](#5-zooming-out-embedded-language-philosophy)
  - [Multiple Isolated Interpreters](#multiple-isolated-interpreters)
  - [Fit-Anywhere Sandboxing](#fit-anywhere-sandboxing)

---

## 1. A "Stackless" Interpreter Design

In a traditional "stackful" interpreter (such as PUC-Rio C Lua), evaluating Lua code or invoking C callbacks pushes call frames directly onto the native host C operating system stack. If a nested call occurs (e.g. `Lua -> C Callback -> Lua -> C Callback`), the host C call stack grows proportionally.

A **Stackless Interpreter** reifies the entire Lua call stack into explicit heap-allocated objects rather than relying on the native C/Rust host function call stack.

```
+-------------------------------------------------------------------+
|                        Host Event Loop / JS                       |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|            Trampoline VM Loop (Executor::step(fuel))               |
|  - Polls VM state                                                 |
|  - Consumes instruction fuel                                      |
|  - Yields control back to host loop safely at any instruction     |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|               Reified VM Stack (Heap Allocation)                  |
|  - Frame 0: Main Script State                                     |
|  - Frame 1: Lua Function Call                                     |
|  - Frame 2: Callback State / Coroutine Thread                     |
+-------------------------------------------------------------------+
```

### Reifying the Call Stack

Instead of executing recursively on the Rust host stack, execution state is captured inside an explicit `Executor` / `Sequence` object. This makes the execution context suspendable at any instruction boundary.

### The Trampoline VM Loop

Execution is driven from the outside via a **trampoline loop** (polling method):

```typescript
// Pseudocode illustrating the stackless polling model
while (executor.hasMoreWork()) {
  const finished = executor.step(fuelAmount);
  if (finished) {
    const result = executor.getResult();
    break;
  }
  // Host remains in full control and can yield to JS event loop or interrupt!
}
```

This pattern mirrors Rust's `Future::poll` or JavaScript Promises: execution makes bounded progress per step and routinely returns control to the host caller.

---

## 2. Benefits of Stackless Architecture

### Cancellation

Because execution is step-based rather than blocking the host thread indefinitely, untrusted Lua scripts containing infinite loops (e.g. `while true do end`) can be **cancelled at any time** simply by stopping calls to `step()` and dropping the executor.

In browser or Node.js event loops, this allows executing untrusted Lua scripts without freezing the web page or server worker thread.

### Pre-emptive Concurrency & Tasklets

Standard Lua coroutines provide **cooperative multitasking**: a script must explicitly call `coroutine.yield()` to yield control. If a script fails or forgets to yield, it hangs the process.

With a stackless architecture, the host can multiplex multiple independent Lua VM instances ("tasklets") in a round-robin scheduler. From the perspective of the Lua script, scheduling is **pre-emptive**—the host pauses execution after a slice of instruction "fuel" is consumed, regardless of whether the Lua script called `coroutine.yield()`.

### Fuel, Pacing, and Custom Scheduling

The execution VM consumes **Fuel** (a bounded instruction step counter). Host applications can implement custom resource pacing strategies:

- **Burst Fuel Tanks**: Grant a script 10,000 instructions per tick, capping runaway scripts while allowing intensive calculations when needed.
- **Paced I/O**: Callbacks can consume or interrupt fuel when waiting for asynchronous data, yielding execution back to Node.js or browser event loops seamlessly.

### Symmetric Coroutines & `coroutine.yieldto`

Standard Lua provides **asymmetric coroutines**: a coroutine yields only back to its caller via `coroutine.yield()`. Attempting to yield directly from one coroutine to another requires nested `coroutine.resume()` calls, which leaks stack frames over long sequences.

Because a stackless VM reifies stack frames into heap data, it supports **symmetric coroutines** natively via `coroutine.yieldto(targetThread)`:

- `coroutine.yieldto(thread)` directly transfers execution to the target thread without accumulating stack frames.
- Enables tail-yield transfers between threads infinitely with zero stack leaks.

---

## 3. The "Big Lie": Comparing with Traditional C-Stack Lua

### The PUC-Rio C Stack Limit

In standard C Lua (PUC-Rio Lua 5.4), `lua_yield()` is implemented via C `longjmp`. This unwinds the C host call stack back up to the nearest `lua_resume()`.

However, if Lua code calls a C function, and that C function calls back into Lua (`Lua -> C -> Lua`), calling `lua_yield()` inside the nested Lua code is **disallowed** because a `longjmp` would destroy essential C stack frames and leak unmanaged C resources.

### The Problem with C `longjmp` and `lua_callk`

To allow yields across C call boundaries, PUC-Rio Lua introduced `lua_callk()` and `lua_pcallk()` continuation functions. However:

- Every C callback must be completely refactored into continuation functions (`lua_KFunction` / `lua_KContext`).
- Almost none of the standard C library in standard Lua is written this way due to extreme complexity.
- Pure Rust stackless architecture solves this cleanly by eliminating native host stack dependency entirely.

---

## 4. Rust Coroutines, Lua Coroutines, and "Snarfing"

### What is "Snarfing"?

"Snarfing" is programming language terminology describing when an embedded runtime automatically inherits features from its host language:

- For example, an embedded language in Go might "snarf" garbage collection by using Go pointers directly.
- In pure-Rust stackless Lua (`ottavino`), Lua's coroutine and garbage collection model is implemented in safe Rust using garbage collection arenas (`gc-arena`).

### Rust Futures & Lua Coroutines

The `Sequence` / `Executor` traits in pure-Rust Lua mirror Rust's `Future` trait:

- Long-running callbacks act as state machines polled to completion.
- Bridges async Rust / JavaScript Promises directly with Lua coroutine yield/resume cycles.

---

## 5. Zooming Out: Embedded Language Philosophy

### Multiple Isolated Interpreters

Unlike languages that force a single global VM instance, stackless pure-Rust Lua allows instantiating **hundreds of isolated Lua VM states** inside a single process:

- Each state has its own independent garbage collection arena (`gc-arena`).
- No global locks or shared mutable states.

### Fit-Anywhere Sandboxing

By eliminating C library dependencies and native C stack unwinding risks, stackless NAPI Lua can be embedded securely anywhere:

- Serverless Node.js functions.
- WebAssembly in modern browsers (`wasm32-unknown-emscripten` / `emnapi`).
- Strict WASI Preview 3 component sandboxes (`Lua.core()`).
