import type { Bead } from "./schema";
import { parentOf } from "./beads-view";

/**
 * Pure progress rules for the home page (no I/O): bulk-close detection,
 * phase completion, pace and recent output. Every input is an issue field
 * that syncs between machines, so the PC and the Mac compute the same page.
 */

export const BULK_CLOSES_PER_MINUTE = 10;
const HOUR_MS = 3600_000;
export const MOVING_MS = 24 * HOUR_MS;
export const SLOW_MS = 72 * HOUR_MS;
export const WEEK_MS = 7 * 24 * HOUR_MS;

export type Pace = "moving" | "slow" | "idle" | "unknown";
export type Phase = {
  id: string;
  title: string;
  done: number;
  total: number;
  inProgress: number;
  lastTouched: string | null;
};

export function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

const minuteKey = (t: number) => new Date(t).toISOString().slice(0, 16);

/**
 * Minutes in which 10 or more issues closed: bulk imports and cleanup sweeps
 * (the 2026-11-11 migration closed 236 Studio issues in one minute). They
 * never count as movement; phase completion still counts them as done.
 */
export function bulkMinutes(beads: Bead[]): Set<string> {
  const counts = new Map<string, number>();
  for (const b of beads) {
    const t = ms(b.closed_at);
    if (t === null) continue;
    const key = minuteKey(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n >= BULK_CLOSES_PER_MINUTE).map(([key]) => key));
}

export function inBulk(iso: string | null | undefined, bulk: Set<string>): boolean {
  const t = ms(iso);
  return t !== null && bulk.has(minuteKey(t));
}

/** The newest timestamp outside a bulk minute, or null. */
function newestReal(isos: (string | null | undefined)[], bulk: Set<string>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const iso of isos) {
    const t = ms(iso);
    if (t === null || inBulk(iso, bulk) || t <= bestMs) continue;
    best = iso as string;
    bestMs = t;
  }
  return best;
}

export function isPhase(b: Bead): boolean {
  return b.issue_type === "epic" && (b.labels ?? []).includes("phase") && b.status !== "closed";
}

/** Each open phase's work: non-epic issues whose nearest phase ancestor it is. */
function phaseWork(beads: Bead[], index: Map<string, Bead>): Map<string, Bead[]> {
  const work = new Map<string, Bead[]>();
  for (const b of beads) if (isPhase(b)) work.set(b.id, []);
  for (const b of beads) {
    if (b.issue_type === "epic") continue;
    const seen = new Set<string>([b.id]);
    let parent = parentOf(b, index);
    while (parent && !seen.has(parent.id)) {
      const bucket = work.get(parent.id);
      if (bucket) {
        bucket.push(b);
        break;
      }
      seen.add(parent.id);
      parent = parentOf(parent, index);
    }
  }
  return work;
}

function comparePhases(a: Phase, b: Phase): number {
  return (
    Number(b.inProgress > 0) - Number(a.inProgress > 0) ||
    (ms(b.lastTouched) ?? 0) - (ms(a.lastTouched) ?? 0) ||
    a.title.localeCompare(b.title)
  );
}

/** Open phases with completion counts, current first (work in progress, then most recently touched). */
export function buildPhases(beads: Bead[], index: Map<string, Bead>, bulk: Set<string>): Phase[] {
  const work = phaseWork(beads, index);
  return beads
    .filter(isPhase)
    .map((epic) => {
      const items = work.get(epic.id) ?? [];
      return {
        id: epic.id,
        title: epic.title,
        done: items.filter((b) => b.status === "closed").length,
        total: items.length,
        inProgress: items.filter((b) => b.status === "in_progress" || b.status === "hooked").length,
        lastTouched: newestReal([epic.updated_at, ...items.map((b) => b.updated_at)], bulk),
      };
    })
    .sort(comparePhases);
}

/** When the project last moved: the newest real update, or the lead's status, whichever is later. */
export function lastMovedAt(beads: Bead[], bulk: Set<string>, statusAt: string | null): string | null {
  const updated = newestReal(beads.map((b) => b.updated_at), bulk);
  if (!statusAt || ms(statusAt) === null) return updated;
  if (!updated) return statusAt;
  return (ms(statusAt) as number) > (ms(updated) as number) ? statusAt : updated;
}

/** Activity, not output: any write counts. */
export function paceOf(lastMoved: string | null, now: number): Pace {
  const t = ms(lastMoved);
  if (t === null) return "unknown";
  const age = now - t;
  if (age < MOVING_MS) return "moving";
  if (age <= SLOW_MS) return "slow";
  return "idle";
}

export function doneThisWeek(beads: Bead[], bulk: Set<string>, now: number): number {
  return beads.filter((b) => {
    const t = ms(b.closed_at);
    return (
      b.status === "closed" &&
      b.issue_type !== "epic" &&
      t !== null &&
      now - t <= WEEK_MS &&
      !inBulk(b.closed_at, bulk)
    );
  }).length;
}

export function lastClosed(
  beads: Bead[],
  bulk: Set<string>,
): { id: string; title: string; closedAt: string } | null {
  let best: Bead | null = null;
  for (const b of beads) {
    if (b.status !== "closed" || inBulk(b.closed_at, bulk)) continue;
    const t = ms(b.closed_at);
    if (t !== null && (best === null || t > (ms(best.closed_at) as number))) best = b;
  }
  return best ? { id: best.id, title: best.title, closedAt: best.closed_at as string } : null;
}
