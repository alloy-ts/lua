# Ottavino / Piccolo Architecture & Stackless Interpreter Guide

This document details the inner architecture of **Ottavino** (derived from **Piccolo** and **`gc-arena`**), the pure-Rust Lua 5.4 virtual machine powering this NAPI binding.

---

## Overview & History

**Piccolo** (and its derivative **Ottavino**) is an interpreter for the Lua 5.4 language written in pure, mostly safe Rust. It was created to provide a resilient, sandboxed Lua execution environment for Rust without relying on external C libraries, unsafe pointer casting, or unmanaged reference cycles.

To handle garbage collection safely in Rust, Piccolo introduced **`gc-arena`**, a tracing garbage collector designed specifically for Rust runtimes.

---

## The "Mutation XOR Collection" Constraint & Stackless VM

`gc-arena` relies on a fundamental safety invariant known as **Mutation XOR Collection**:

- Code mutating garbage-collected objects must do so through controlled mutation context methods (`Arena::mutate`).
- Garbage collection can **only** execute when no mutation context methods are active, ensuring no garbage-collected pointers reside unprotected on the native Rust function call stack.

To satisfy this constraint, the VM interpreter must be **stackless**.

---

## A "Stackless" Interpreter Design

In a traditional "stackful" interpreter (such as PUC-Rio C Lua), call frames and VM execution state rely directly on the host language's function call stack (C stack or Rust stack).

In Piccolo / Ottavino, the VM is **stackless**:

1. **Reified Call Stack**: The entire VM execution state—including Lua call frames, local variables, registers, and Rust callbacks—is reified as a data structure in memory.
2. **Polling / Trampoline Loop**: Execution does not run in a blocking recursive call loop. Instead, execution is driven from the outside by stepping through an `Executor`:

```rust
// Pseudocode demonstrating the stackless trampoline execution model
let mut executor = ...;

loop {
    let done = executor.step(ctx, &mut fuel);
    if done {
        // Computation completed
        break;
    }
    // Execution suspended; safe to collect garbage or pause execution
}
```

This model is conceptually identical to **Async Rust Futures**, where long-running asynchronous computations are reified into state machines that must be polled (`Future::poll`).

---

## Benefits of Stackless

### 1. Instant Cancellation

Because execution is driven explicitly step-by-step from the host runtime, cancelling a running script requires no special `longjmp` calls or native signal hooks. Dropping or halting step calls instantly cancels script execution without leaking native memory or destabilizing the process.

### 2. Pre-emptive Concurrency & Tasklets

Standard Lua coroutines provide _cooperative_ multitasking—a script must explicitly call `coroutine.yield()`. If a script enters an infinite loop, it hangs the host thread.

In Piccolo / Ottavino:

- Running scripts are encapsulated in `Executor` tasklets.
- The host application can multiplex multiple `Executor` tasklets in a round-robin schedule by stepping each executor for a fixed amount of instruction "fuel".
- This provides **pre-emptive multitasking** for untrusted scripts: no script can hog CPU time or hang the application.

### 3. Fuel, Pacing, and Custom Scheduling

Execution progress is bounded by a **`Fuel`** parameter:

- Every Lua bytecode instruction and Rust callback consumes fuel.
- `Executor::step()` returns immediately when fuel is exhausted or when `Fuel::interrupt()` is called.
- Applications can implement custom scheduling policies, such as "burst fuel" allocations or yielding control to Node.js event loops during hot loops.

### 4. Symmetric Coroutines & `coroutine.yieldto`

Standard Lua supports _asymmetric coroutines_ (`coroutine.create`, `coroutine.resume`, `coroutine.yield`), where yield returns strictly to the immediate caller. Attempting to mutual-yield between coroutines in standard Lua causes stack leaks because tail-yields are not natively supported by C call stacks.

Because Piccolo / Ottavino reifies call frames into trampoline data structures, it natively supports **symmetric coroutines** via `coroutine.yieldto(co)`:

```lua
-- Direct symmetric yield to another coroutine without stack accumulation
coroutine.yieldto(targetThread)
```

In Ottavino, `coroutine.yieldto` is implemented cleanly via `CallbackReturn::Yield { to_thread: Some(thread), then: None }`, jumping directly back to the outer executor trampoline without stack accumulation.

---

## The "Big Lie": Why PUC-Rio C Lua Cannot Match This Easily

PUC-Rio C Lua attempts to support periodic yields via debug hooks (`lua_sethook`). However, in standard C Lua:

- Calling `lua_yield` from inside C callbacks (such as `table.sort` or metamethod calls) fails or crashes because `lua_yield` uses C `longjmp` to unwind the C stack.
- Unwinding the C stack destroys active C frame state.

PUC-Rio introduced `lua_callk` / `lua_yieldk` / `lua_KFunction` to allow C callbacks to pass continuation functions. However, rewriting C standard libraries using continuation state machines is notoriously complex and error-prone.

In Piccolo / Ottavino, all callback interfaces implement state polling (`Sequence`), allowing seamless yields across any depth of `Lua -> Rust -> Lua` calls without risking native stack corruption.

---

## Rust Coroutines, Lua Coroutines, and Snarfing

**Snarfing** is a programming language implementation technique where an embedded language (Lua) absorbs ("snarfs") features directly from the host language (Rust).

In Piccolo / Ottavino:

- Long-running Rust callbacks implement a `Sequence` trait (similar to `Future`).
- `Sequence` state machines allow Rust code to yield control, consume fuel, and resume cleanly.
- This design mirrors how Rust `async`/`await` state machines operate, laying the foundation for seamless integration between Rust coroutines and Lua coroutines.

---

## Zooming Out: Embedded Resiliency

The ultimate goal of Piccolo and Ottavino is to provide a Lua runtime that **fits anywhere**:

- **Isolation**: Multiple independent `Lua` VM instances can run concurrently without sharing global state or suffering process-wide GC pauses.
- **Safety**: Pure Rust safety guarantees that untrusted user scripts cannot corrupt memory, trigger buffer overflows, or escape sandboxes.
- **Flexibility**: Lightweight, configurable standard library subsets (`empty`, `core`, `full`) ensure minimal memory footprint and maximum sandboxing security.
