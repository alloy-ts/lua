# Ottavino / Piccolo VM Architecture Guide

This document explains the underlying architecture of **Ottavino** (a pure Rust fork of the **Piccolo** Lua 5.4 VM), the motivations behind its "stackless" design, and how its concepts apply when embedding Lua into Node.js/JavaScript applications via NAPI.

---

## 1. A "Stackless" Interpreter Design

In traditional "stackful" interpreters (such as standard PUC-Rio C Lua or standard CPython), execution state is maintained directly on the host language's C call stack. When a Lua script invokes a function or callback, native C stack frames are pushed for each call level.

In contrast, Ottavino (Piccolo) uses a **stackless** (or trampoline) VM design.

### How It Works Under the Hood
- The VM execution state and call stack are reified into heap-allocated objects (`Executor`, `Thread`, `Stack`).
- Execution is driven from the outside by polling (`Executor::step(ctx, &mut fuel)`).
- The VM runs for a bounded unit of work (controlled by `fuel`) and returns control back to the host loop before fuel is exhausted or whenever progress is complete.

```rust
// Conceptual polling loop in Ottavino
loop {
    let has_more_work = executor.step(ctx, &mut fuel);
    if !has_more_work {
        break; // VM finished execution
    }
    // Host retains full control here and can collect garbage, yield, or cancel!
}
```

This design mirrors Rust's `Future` trait and `async`/`await` model: long-running computations are reified into state machines driven by polling.

---

## 2. Benefits of Stackless

### Cancellation
Because execution is explicitly polled from the host loop rather than holding the native C/Rust call stack hostage, cancellation is effortless:
- To cancel an execution (e.g., an infinite loop `while true do end`), the host simply stops calling `executor.step()` and drops the `Executor` handle.
- No unsafe thread termination or stack unwinding hacks are required.

### Pre-emptive Concurrency
Standard Lua coroutines are **cooperative**: scripts must explicitly invoke `coroutine.yield()` to yield control. If a script enters a tight non-yielding loop, the host application hangs.

With Ottavino's stackless stepping:
- Multiple independent Lua tasklets or executors can be multiplexed in a round-robin schedule by giving each a fuel allocation.
- This creates **pre-emptive multitasking** for Lua scripts without requiring OS threads or data races.
- The host loop retains full control to interleave execution across multiple sandboxed scripts.

### Fuel, Pacing, and Custom Scheduling
Execution progress is strictly bounded by a `Fuel` budget (a decrementing budget tracking VM instruction steps):
- **Bounded execution:** `Executor::step` returns in guaranteed bounded time proportional to the given fuel.
- **Fair scheduling:** Untrusted or heavy scripts can be allocated limited fuel per frame, preventing rogue scripts from starving host responsiveness.
- **Fuel Interrupts:** Callbacks or I/O operations can consume remaining fuel or call `Fuel::interrupt()` to immediately return control to the host event loop.

### "Symmetric" Coroutines and `coroutine.yieldto`
Standard Lua coroutines are **asymmetric**: a coroutine can only yield back to its direct caller (`coroutine.resume`). Implementing symmetric coroutines (where coroutine A yields directly to coroutine B without building up a call stack) in standard Lua requires an external runner to avoid stack memory leaks.

Because Ottavino's control flow is reified into the `Executor` trampoline structure:
- Ottavino natively provides `coroutine.yieldto(target_thread, ...)`.
- Coroutines can jump directly to any other coroutine in constant stack space, providing true **symmetric coroutines**.

---

## 3. The "Big Lie"

It is often claimed that standard C Lua cannot do any of these stackless or pre-emptive operations. That is "The Big Lie"—PUC-Rio Lua *can* actually do roughly 70% of this out of the box using `lua_sethook` and `lua_yield`.

### The Problem in C Lua
When C Lua calls a C callback that in turn calls back into Lua (`Lua -> C -> Lua` sandwich, e.g. `table.sort` with a custom comparator), `lua_yield` cannot cross the C stack boundary without a C `longjmp`.
- `longjmp` destroys C stack frames without proper cleanup or destructors.
- PUC-Rio Lua introduced `lua_callk` and continuation functions (`lua_KFunction`) to handle yields in C, but transforming C code to use continuation functions is notoriously difficult and error-prone.

### Why Ottavino Solves This
Ottavino enforces a stackless design in Rust at the foundational level. All sequence callbacks (`Sequence` trait) are constructed to be polled, allowing arbitrary nested Lua and callback states to suspend cleanly without relying on the native Rust stack.

---

## 4. Rust Coroutines, Lua Coroutines, and "Snarfing"

### What is Snarfing?
**Snarfing** is programming language taxonomy slang: when implementing language B inside host language A, language B automatically inherits ("snarfs") features from language A. For example, embedded interpreters often snarf memory management from host GC or host reference counting.

### The GC & Stackless Synergy
Ottavino uses `gc-arena` for precise, safe tracing garbage collection in Rust.
- `gc-arena` relies on a "Mutation XOR Collection" invariant: garbage collection can **only** occur when no active mutation references (`&Context`) exist on the host stack.
- To allow garbage collection during long-running Lua scripts, execution **must** be suspendable so that `Arena::mutate` calls can exit.
- Thus, the stackless interpreter design and fuel-stepping model were born out of the necessity to exit `Arena::mutate` and run GC collection cycles.

In the future, as Rust's stackless coroutines (`async`/`await` / `Coroutine` trait) mature, language VMs will be able to snarf stackless state machines directly from the Rust compiler, eliminating manual trampoline state wrapping.

---

## 5. Zooming Out: Embedded VMs & Systems Programming

A core principle of embeddable scripting languages is that they should fit **anywhere** with minimal global assumptions:
- **Isolation:** Instead of a single monolithic global VM or global garbage collector, applications can instantiate as many isolated `Lua` VM instances as needed.
- **Sandboxing:** Untrusted user code can be safely executed with strict memory limits, custom fuel budgets, and stripped standard libraries (`Lua.empty()` or `Lua.core()`).
- **Resiliency:** Unhandled Lua errors or infinite loops cannot crash or hang the host process.

By combining NAPI, `gc-arena`, and Ottavino's stackless VM architecture, `@alloy-ts/lua` provides Node.js and TypeScript applications with a safe, flexible, and completely sandboxed Lua environment.
