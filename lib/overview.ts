import type { Bead } from "./schema";
import { latestAnswer } from "./answer";
import { isBlocked, isHumanGate, makeIndex, needsHuman } from "./beads-view";
import {
  bulkMinutes,
  buildPhases,
  doneThisWeek,
  lastClosed,
  lastMovedAt,
  ms,
  paceOf,
  type Pace,
  type Phase,
} from "./overview-progress";

/**
 * Pure rules for Scotty's home (no I/O): what needs Esteban, the lead's
 * status, and one tile per project. Progress rules live in
 * overview-progress.ts; the route in app/api/overview does the I/O.
 */

export type { Pace, Phase } from "./overview-progress";

export type LeadRef = { id: string; title: string | null; link: string };
export type Ask = {
  projectId: string;
  projectName: string;
  id: string;
  title: string;
  kind: "decision" | "human" | "gate";
  createdAt: string | null;
};
export type TopAsk = Ask & { text: string; source: "lead" | "priority" };
export type AnsweredAsk = Ask & { answeredAt: string | null; answer: string | null };
export type Status = { moved: string | null; next: string | null; at: string | null; stale: boolean };
export type Tile = {
  id: string;
  name: string;
  state: "ok" | "not-on-beads" | "error";
  error?: string;
  pace: Pace;
  lastMovedAt: string | null;
  doneThisWeek: number;
  phases: Phase[];
  status: Status;
  lastClosed: { id: string; title: string; closedAt: string } | null;
  asksOpen: Ask[];
  asksWaiting: Ask[];
  asksAnswered: AnsweredAsk[];
  topAsk: TopAsk | null;
  lead: LeadRef | null;
};
export type Home = { generatedAt: string; needsNow: TopAsk[]; projects: Tile[] };
export type ProjectRef = { id: string; name: string };
export type Kv = Record<string, unknown>;

// A guard against runaway text, not an edit: the tile clamps visually and Details shows the rest (spec 5.2).
const STATUS_MAX = 500;
const STALE_MS = 24 * 3600_000;
const ISO_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
const LEAD_ID_RE = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function clip(text: string | null): string | null {
  if (!text) return null;
  return text.length > STATUS_MAX ? `${text.slice(0, STATUS_MAX).trimEnd()}...` : text;
}

/** The lead session on an issue; only app session ids become links. */
export function leadRef(metadata: Record<string, unknown> | undefined): LeadRef | null {
  const id = str(metadata?.lead);
  if (!id || !LEAD_ID_RE.test(id)) return null;
  return { id, title: str(metadata?.lead_title), link: `claude://claude.ai/epitaxy/${id}` };
}

/** Something Esteban has to answer or do: `bd human`, a human gate, or an open decision that is not a knowledge bead. */
export function isAsk(b: Bead): boolean {
  if (b.status === "closed" || b.status === "deferred") return false;
  if (needsHuman(b) || isHumanGate(b)) return true;
  return b.issue_type === "decision" && !(b.labels ?? []).includes("kb");
}

function toAsk(project: ProjectRef, b: Bead): Ask {
  const kind = isHumanGate(b) ? "gate" : b.issue_type === "decision" ? "decision" : "human";
  return { projectId: project.id, projectName: project.name, id: b.id, title: b.title, kind, createdAt: b.created_at ?? null };
}

/** An ask Esteban has answered: it stays open until the lead acts, labelled `answered`. */
export function isAnswered(b: Bead): boolean {
  return (b.labels ?? []).includes("answered");
}

/** Esteban's newest answer on an issue: the latest comment he authored, else none. */
function toAnswered(project: ProjectRef, b: Bead, humanActor: string | undefined): AnsweredAsk {
  const latest = latestAnswer(b.comments, humanActor);
  return {
    ...toAsk(project, b),
    answeredAt: latest?.created_at ?? b.updated_at ?? null,
    answer: latest ? clip(latest.text.trim()) : null,
  };
}

const byNewestAnswer = (a: AnsweredAsk, b: AnsweredAsk) => (ms(b.answeredAt) ?? 0) - (ms(a.answeredAt) ?? 0);

const byOldest = (a: { createdAt: string | null }, b: { createdAt: string | null }) =>
  (ms(a.createdAt) ?? Infinity) - (ms(b.createdAt) ?? Infinity);

export function readStatus(kv: Kv, lastMoved: string | null): Status {
  const rawAt = str(kv["status.at"]);
  const at = rawAt && ISO_RE.test(rawAt) && ms(rawAt) !== null ? rawAt : null;
  const moved = ms(lastMoved);
  const stale = at !== null && moved !== null && moved - (ms(at) as number) > STALE_MS;
  return { moved: clip(str(kv["status.moved"])), next: clip(str(kv["status.next"])), at, stale };
}

function topAsk(project: ProjectRef, kv: Kv, index: Map<string, Bead>, open: Bead[]): TopAsk | null {
  const pickedId = str(kv["status.ask_id"]);
  const picked = pickedId ? index.get(pickedId) : undefined;
  if (picked && isAsk(picked) && !isAnswered(picked)) {
    const ask = toAsk(project, picked);
    return { ...ask, text: clip(str(kv["status.ask"])) ?? ask.title, source: "lead" };
  }
  const urgent = open.filter((b) => b.priority <= 1).map((b) => toAsk(project, b)).sort(byOldest)[0];
  return urgent ? { ...urgent, text: urgent.title, source: "priority" } : null;
}

function tileLead(beads: Bead[]): LeadRef | null {
  let best: { lead: LeadRef; at: number } | null = null;
  for (const b of beads) {
    if (b.status !== "in_progress" && b.status !== "hooked") continue;
    const lead = leadRef(b.metadata);
    const at = ms(b.updated_at) ?? 0;
    if (lead && (best === null || at > best.at)) best = { lead, at };
  }
  return best?.lead ?? null;
}

export function buildTile(project: ProjectRef, beads: Bead[], kv: Kv, now: Date, humanActor?: string): Tile {
  const index = makeIndex(beads);
  const bulk = bulkMinutes(beads);
  const statusAt = readStatus(kv, null).at;
  const moved = lastMovedAt(beads, bulk, statusAt);
  const asks = beads.filter(isAsk);
  const answered = asks.filter(isAnswered);
  const pending = asks.filter((b) => !isAnswered(b));
  const open = pending.filter((b) => !isBlocked(b, index));
  const waiting = pending.filter((b) => isBlocked(b, index));
  return {
    id: project.id,
    name: project.name,
    state: "ok",
    pace: paceOf(moved, now.getTime()),
    lastMovedAt: moved,
    doneThisWeek: doneThisWeek(beads, bulk, now.getTime()),
    phases: buildPhases(beads, index, bulk),
    status: readStatus(kv, moved),
    lastClosed: lastClosed(beads, bulk),
    asksOpen: open.map((b) => toAsk(project, b)).sort(byOldest),
    asksWaiting: waiting.map((b) => toAsk(project, b)).sort(byOldest),
    asksAnswered: answered.map((b) => toAnswered(project, b, humanActor)).sort(byNewestAnswer),
    topAsk: topAsk(project, kv, index, open),
    lead: tileLead(beads),
  };
}

/**
 * Whether the tile shows any recorded work: phase work, asks or a real close.
 * Separates "never had activity" from "all its history arrived in a bulk import"
 * when the pace is unknown, so the label never contradicts the tile's own meters.
 */
export function hasRecordedWork(tile: Tile): boolean {
  return (
    tile.phases.some((p) => p.total > 0) ||
    tile.asksOpen.length + tile.asksWaiting.length + tile.asksAnswered.length > 0 ||
    tile.lastClosed !== null
  );
}

/** A project with no issue data (not on Beads, or its read failed). */
export function emptyTile(project: ProjectRef, state: "not-on-beads" | "error", error?: string): Tile {
  return {
    id: project.id,
    name: project.name,
    state,
    ...(error ? { error } : {}),
    pace: "unknown",
    lastMovedAt: null,
    doneThisWeek: 0,
    phases: [],
    status: { moved: null, next: null, at: null, stale: false },
    lastClosed: null,
    asksOpen: [],
    asksWaiting: [],
    asksAnswered: [],
    topAsk: null,
    lead: null,
  };
}

const active = (t: Tile) => t.pace === "moving" || t.pace === "slow";

/** Stable order (Esteban, 2026-11-11): active projects first, then the rest, by name. Asks never reorder. */
export function compareTiles(a: Tile, b: Tile): number {
  return (
    Number(active(b)) - Number(active(a)) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

export function buildHome(tiles: Tile[], now: Date): Home {
  return {
    generatedAt: now.toISOString(),
    needsNow: tiles.flatMap((t) => (t.topAsk ? [t.topAsk] : [])).sort(byOldest),
    projects: [...tiles].sort(compareTiles),
  };
}
