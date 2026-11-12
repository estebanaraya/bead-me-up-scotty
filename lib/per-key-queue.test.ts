import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingKeys, runExclusive } from "./per-key-queue";

/** A promise with its resolve and reject handed out, so a test controls when a task ends. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setImmediate(r));

test("per-key queue: tasks for one key run strictly in order", async () => {
  const log: string[] = [];
  const first = deferred();
  const a = runExclusive("p:x-1", async () => {
    log.push("a start");
    await first.promise;
    log.push("a end");
    return "a";
  });
  const b = runExclusive("p:x-1", async () => {
    log.push("b start");
    return "b";
  });
  await tick();
  assert.deepEqual(log, ["a start"]);
  first.resolve();
  assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
  assert.deepEqual(log, ["a start", "a end", "b start"]);
});

test("per-key queue: different keys run concurrently", async () => {
  const log: string[] = [];
  const hold = deferred();
  const a = runExclusive("p:x-1", async () => {
    log.push("a start");
    await hold.promise;
  });
  const b = runExclusive("p:x-2", async () => {
    log.push("b start");
  });
  await b;
  assert.deepEqual(log, ["a start", "b start"]);
  hold.resolve();
  await a;
});

test("per-key queue: a rejected task does not block the next", async () => {
  const failing = runExclusive("p:x-1", async () => {
    throw new Error("bd failed");
  });
  const next = runExclusive("p:x-1", async () => "ran");
  await assert.rejects(failing, /bd failed/);
  assert.equal(await next, "ran");
});

test("per-key queue: no key is held once every task has settled", async () => {
  const hold = deferred();
  const a = runExclusive("p:x-1", () => hold.promise);
  const b = runExclusive("p:x-1", async () => {
    throw new Error("nope");
  });
  const c = runExclusive("p:x-2", async () => {});
  assert.equal(pendingKeys(), 2);
  hold.resolve();
  await Promise.allSettled([a, b, c]);
  await tick();
  assert.equal(pendingKeys(), 0);
});
