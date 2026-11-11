import type { Bead } from "./schema";
import type { EventRow } from "./bd";
import { isBlocked, makeIndex, needsHuman, readyHumanGate } from "./beads-view";

/**
 * Pure rules for the cross-project overview (no I/O): which issues are in
 * flight, blocked or waiting on a person, who is on them, and how bd's audit
 * events read as an activity feed. The route in app/api/overview does the I/O.
 */

export const ACTIVITY_WINDOW_MS = 24 * 3600 * 1000;
export const ACTIVITY_LIMIT = 200;
const SNIPPET_MAX = 140;

export type LeadRef = {
  id: string;
  title: string | null;
  link: string;
};
export type IssueRow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  agent: string | null;
  lead: LeadRef | null;
  updatedAt: string | null;
  latestNote: string | null;
};
export type ProjectOverview = {
  id: string;
  name: string;
  state: "ok" | "not-on-beads" | "error";
  error?: string;
  leads: LeadRef[];
  inFlight: IssueRow[];
  blocked: IssueRow[];
  needsYou: IssueRow[];
  closed24h: number;
  lastActivity: string | null;
  activityState: "ok" | "unavailable";
};
export type ActivityItem = {
  projectId: string;
  projectName: string;
  at: string;
  issueId: string;
  title: string | null;
  actor: string;
  kind: string;
  detail: string | null;
};
export type Overview = {
  generatedAt: string;
  totals: { inFlight: number; blocked: number; needsYou: number; closed24h: number };
  projects: ProjectOverview[];
  activity: ActivityItem[];
};
export type ProjectRef = { id: string; name: string };

/** Start of the activity window as `YYYY-MM-DDTHH:MM:SSZ` (the only value interpolated into SQL). */
export function cutoffIso(now: Date): string {
  return new Date(now.getTime() - ACTIVITY_WINDOW_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function clip(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX).trimEnd()}...` : t;
}

function firstLine(text: string): string | null {
  return clip(text.trim().split(/\r?\n/)[0] ?? "");
}

/**
 * The newest note: the last non-empty line of a notes field, cut to 140
 * characters. `bd note` appends each entry on its own line, so the last line
 * is the latest one.
 */
export function latestNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const lines = notes.split(/\r?\n/).filter((line) => line.trim() !== "");
  const last = lines[lines.length - 1];
  return last ? clip(last) : null;
}

/** The lead session recorded on an issue; null unless metadata `lead` is a non-empty string. */
export function leadRef(metadata: Record<string, unknown> | undefined): LeadRef | null {
  const id = str(metadata?.lead);
  if (!id) return null;
  return { id, title: str(metadata?.lead_title), link: `claude://claude.ai/epitaxy/${id}` };
}

export function toIssueRow(b: Bead): IssueRow {
  return {
    id: b.id,
    title: b.title,
    status: b.status,
    priority: b.priority,
    agent: str(b.metadata?.agent),
    lead: leadRef(b.metadata),
    updatedAt: b.updated_at ?? null,
    latestNote: latestNote(b.notes),
  };
}

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

function byUpdatedDesc(a: IssueRow, b: IssueRow): number {
  return ms(b.updatedAt) - ms(a.updatedAt) || a.id.localeCompare(b.id);
}

export function isInFlight(b: Bead): boolean {
  return b.status === "in_progress" || b.status === "hooked";
}

/** Waiting on a person: `bd human`, a ready human gate, or an open decision that is not a knowledge bead. */
export function needsYou(b: Bead, index: Map<string, Bead>): boolean {
  if (needsHuman(b) || readyHumanGate(b, index)) return true;
  return (
    b.issue_type === "decision" &&
    b.status !== "closed" &&
    b.status !== "deferred" &&
    !(b.labels ?? []).includes("kb")
  );
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Feed wording for one audit row. Unknown event types pass through as their raw name. */
export function eventKind(e: EventRow): { kind: string; detail: string | null } {
  const raw = e.new_value ?? "";
  switch (e.event_type) {
    case "created":
    case "claimed":
    case "reopened":
    case "commented":
      return { kind: e.event_type, detail: null };
    case "closed":
      return { kind: "closed", detail: firstLine(raw) };
    case "label_added":
    case "label_removed": {
      // bd records the label in `comment` ("Added label: x"), not in new_value.
      const label = (e.comment ?? "").replace(/^(Added|Removed) label:\s*/i, "") || raw;
      return { kind: e.event_type === "label_added" ? "label +" : "label -", detail: clip(label) };
    }
    case "updated": {
      const value = asRecord(parseJson(raw));
      // Not JSON: treat the value as plain text.
      if (!value) return { kind: "updated", detail: firstLine(raw) };
      if ("notes" in value) {
        return { kind: "noted", detail: typeof value.notes === "string" ? latestNote(value.notes) : null };
      }
      const meta =
        typeof value.metadata === "string" ? asRecord(parseJson(value.metadata)) : asRecord(value.metadata);
      const agent = str(meta?.agent);
      return agent ? { kind: "dispatched", detail: agent } : { kind: "updated", detail: null };
    }
    default:
      return { kind: e.event_type, detail: null };
  }
}

export function toActivity(project: ProjectRef, events: EventRow[]): ActivityItem[] {
  return events.map((e) => ({
    projectId: project.id,
    projectName: project.name,
    at: e.created_at,
    issueId: e.issue_id,
    title: e.title ?? null,
    actor: e.actor,
    ...eventKind(e),
  }));
}

/** A project that produced no issue data (not on Beads, or its read failed). */
export function emptyProject(
  project: ProjectRef,
  state: "not-on-beads" | "error",
  error?: string,
): ProjectOverview {
  return {
    id: project.id,
    name: project.name,
    state,
    ...(error ? { error } : {}),
    leads: [],
    inFlight: [],
    blocked: [],
    needsYou: [],
    closed24h: 0,
    lastActivity: null,
    activityState: state === "error" ? "unavailable" : "ok",
  };
}

/** One project's overview from its beads; `events` is null when the audit query failed. */
export function buildProject(
  project: ProjectRef,
  beads: Bead[],
  events: EventRow[] | null,
  cutoff: string,
): ProjectOverview {
  const index = makeIndex(beads);
  const inFlightBeads = beads.filter(isInFlight);
  const rows = (list: Bead[]) => list.map(toIssueRow).sort(byUpdatedDesc);

  const leads = new Map<string, LeadRef>();
  for (const b of inFlightBeads) {
    const lead = leadRef(b.metadata);
    // Prefer the entry that carries a title when one lead appears on several issues.
    if (lead && (!leads.has(lead.id) || (lead.title && !leads.get(lead.id)?.title))) {
      leads.set(lead.id, lead);
    }
  }

  const cutoffMs = Date.parse(cutoff);
  const newest = (events ?? []).reduce<string | null>(
    (best, e) => (best === null || ms(e.created_at) > ms(best) ? e.created_at : best),
    null,
  );

  return {
    id: project.id,
    name: project.name,
    state: "ok",
    leads: [...leads.values()],
    inFlight: rows(inFlightBeads),
    blocked: rows(beads.filter((b) => !isInFlight(b) && isBlocked(b, index))),
    needsYou: rows(beads.filter((b) => needsYou(b, index))),
    closed24h: beads.filter((b) => b.closed_at && Date.parse(b.closed_at) >= cutoffMs).length,
    lastActivity: newest,
    activityState: events === null ? "unavailable" : "ok",
  };
}

function hasWork(p: ProjectOverview): boolean {
  return p.inFlight.length > 0 || p.blocked.length > 0 || p.needsYou.length > 0;
}

/**
 * Stable order, so cards do not move while agents write: projects with
 * in-flight, blocked or needs-you work first, then idle ones, each group by
 * name, case-insensitive.
 */
export function compareProjects(a: ProjectOverview, b: ProjectOverview): number {
  return (
    Number(hasWork(b)) - Number(hasWork(a)) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

export function buildOverview(
  parts: { project: ProjectOverview; activity: ActivityItem[] }[],
  now: Date,
): Overview {
  const projects = parts.map((p) => p.project).sort(compareProjects);
  const sum = (pick: (p: ProjectOverview) => number) => projects.reduce((n, p) => n + pick(p), 0);
  return {
    generatedAt: now.toISOString(),
    totals: {
      inFlight: sum((p) => p.inFlight.length),
      blocked: sum((p) => p.blocked.length),
      needsYou: sum((p) => p.needsYou.length),
      closed24h: sum((p) => p.closed24h),
    },
    projects,
    activity: parts
      .flatMap((p) => p.activity)
      .sort((a, b) => ms(b.at) - ms(a.at))
      .slice(0, ACTIVITY_LIMIT),
  };
}
