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

/** The seen set for one project. */
export type EscalationState = { projectId: string; seen: Set<string> };

/**
 * escalationsSince, scoped to a project. A state from another project counts as
 * no state, so a project switch is a silent baseline rather than a notification
 * for every ask already waiting in the new project.
 */
export function projectEscalationsSince(
  prev: EscalationState | null,
  projectId: string,
  beads: Bead[],
): { state: EscalationState; raised: Bead[] } {
  const base = prev !== null && prev.projectId === projectId ? prev.seen : null;
  const { seen, raised } = escalationsSince(base, beads);
  return { state: { projectId, seen }, raised };
}
