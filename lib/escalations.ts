import type { Bead } from "./schema";
import { awaitingHuman } from "./beads-view";

/**
 * Which beads newly wait on the owner since the last tick, for the "Needs you"
 * notification. `seen` is replaced every tick with the ids waiting now, so an
 * answered ask leaves it silently (nothing fires on the way out) and a re-ask,
 * once its `answered` label is removed, is new again and raised like any ask.
 * A null `prev` is the first tick: a silent baseline.
 */
export function escalationsSince(prev: Set<string> | null, beads: Bead[]): { seen: Set<string>; raised: Bead[] } {
  const waiting = beads.filter(awaitingHuman);
  const seen = new Set(waiting.map((b) => b.id));
  if (prev === null) return { seen, raised: [] };
  return { seen, raised: waiting.filter((b) => !prev.has(b.id)) };
}
