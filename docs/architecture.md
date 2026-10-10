# Ottavino Architecture Overview

This document provides a detailed technical overview of `ottavino` (the pure-Rust Lua 5.4 VM) and how its stackless interpreter design is exposed via NAPI-RS bindings.

---

## 1. Stackless Interpreter Design

`ottavino` is an interpreter for Lua 5.4 written in pure, mostly safe Rust. It uses `gc-arena` for tracing garbage collection.

### Why "Stackless"?

In traditional interpreter designs, calling a Lua function from C/Rust uses native stack frames on the host system call stack. If a nested call occurs (Host -> Lua -> Host -> Lua), suspending or yielding execution is difficult because native stack frames cannot be trivially serialized or yielded.

`ottavino` employs a **stackless (trampoline-based)** design:

- The VM execution state, stack frames, upvalues, and registers are reified into heap-allocated Rust structs inside `gc-arena`.
- Execution is driven from the outside by stepping the executor (`Executor::step`).
- No native call stack frames are retained during VM steps, allowing computation to be suspended, resumed, or garbage collected between steps.

---

## 2. Fuel, Pacing, and Bounded Stepping

To ensure safe sandboxing and resiliency against infinite loops in untrusted Lua code:

- `ottavino` uses a **Fuel** counter.
- Every VM step consumes fuel.
- `Executor::step` returns as soon as fuel is exhausted, giving full pacing and scheduling control back to the host environment (Node.js / TypeScript).

---

## 3. Coroutines and Multitasking

- Lua 5.4 coroutines (`coroutine.create`, `coroutine.resume`, `coroutine.yield`) are supported.
- Because execution state is stackless, coroutines can yield and resume cooperatively without native call stack limits.

---

## 4. API Coverage Summary: `ottavino` vs. Exported NAPI Bindings

The table below outlines the underlying `ottavino` Crate API capabilities and their corresponding NAPI bindings exported to JavaScript/TypeScript:

| `ottavino` Rust API                   | NAPI Exported JS/TS API   | Status & Description                                                                          |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `Lua::empty()`                        | `Lua.empty()`             | ✅ Instantiates an empty Lua VM without stdlib                                                |
| `Lua::core()`                         | `Lua.core()`              | ✅ Instantiates a Lua VM with non-I/O stdlib (`base`, `coroutine`, `math`, `string`, `table`) |
| `Lua::full()`                         | `Lua.full()`              | ✅ Instantiates a Lua VM with full stdlib (including `io`)                                    |
| `Lua::load_core()`                    | `lua.loadCore()`          | ✅ Dynamically loads core stdlib into state                                                   |
| `Lua::load_io()`                      | `lua.loadIo()`            | ✅ Dynamically loads I/O stdlib into state                                                    |
| `Lua::total_memory()`                 | `lua.totalMemory()`       | ✅ Returns memory allocated by VM in bytes                                                    |
| `Lua::gc_collect()`                   | `lua.gcCollect()`         | ✅ Triggers a full garbage collection cycle                                                   |
| `Lua::gc_metrics()`                   | `lua.gcMetrics()`         | ✅ Returns `GcMetrics` (`totalAllocation`, `allocationDebt`)                                  |
| `Context::globals().set()`            | `lua.setGlobal(key, val)` | ✅ Injects global string variables into Lua environment                                       |
| `Closure::load` + `Executor::execute` | `lua.eval(code)`          | ✅ Compiles and evaluates Lua code, returning result string or throwing JS error              |
