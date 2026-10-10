import { runCoroutineDemo } from "./coroutine.ts";

/**
 * Demo: Asynchronous and Cooperative Execution in Lua (`examples/async.ts`).
 *
 * In Lua, asynchronous patterns are natively implemented using Coroutines (`coroutine` library).
 * See `examples/coroutine.ts` for full details on `coroutine.create`, `coroutine.yield`, and `coroutine.resume`.
 */

export { runCoroutineDemo as runAsyncDemo };

if (import.meta.url === `file://${process.argv[1]}`) {
  runCoroutineDemo();
}
