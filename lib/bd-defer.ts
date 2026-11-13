import { BdError } from "./bd-exec";

// No "server-only" import here, so node:test can load this module directly.

/**
 * Moves a just-created bead to the backlog with `runUpdate` (`bd update <id> -s
 * deferred`). The create has already landed, so a failure here must not reach
 * the caller as a failed create: the caller would retry into a duplicate. A
 * failed deferral is retried once (setting a status is idempotent), except after
 * a timeout, which already held the repo's queue for a full write limit. If it
 * still fails, `warn` records it and the bead stays in its created status.
 * Resolves true when the bead was deferred.
 */
export async function deferCreated(
  id: string,
  runUpdate: () => Promise<unknown>,
  warn: (message: string) => void = console.warn,
): Promise<boolean> {
  let last: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await runUpdate();
      return true;
    } catch (e) {
      last = e;
      if (e instanceof BdError && e.code === "bd_timeout") break;
    }
  }
  const reason = last instanceof Error ? last.message : String(last);
  warn(`bd: created ${id} but could not move it to the backlog: ${reason}`);
  return false;
}
