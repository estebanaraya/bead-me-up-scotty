/**
 * Runs async work one at a time per key, in arrival order; different keys run concurrently.
 * Used where a read-then-write must not interleave with another request for the same
 * thing (answering one issue). Chains like serializeWrite in bd.ts: a failed task never
 * blocks the next, and a key is forgotten once its last task settles.
 */
const tails = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.then(
    () => {},
    () => {},
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return next;
}

/** How many keys still have work queued or running; for tests. */
export function pendingKeys(): number {
  return tails.size;
}
