"use client";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { catColor, relTime } from "@/lib/beads-view";
import { hasRecordedWork, type Ask, type LeadRef, type Tile } from "@/lib/overview";
import { cn } from "@/lib/utils";

const enc = encodeURIComponent;
export const boardHref = (projectId: string) => `/p/${enc(projectId)}?view=board`;
export const askHref = (projectId: string, issueId: string) =>
  `/p/${enc(projectId)}?view=focus&bead=${enc(issueId)}`;

/**
 * The home's keyboard focus ring, drawn inside the control so clipping parents never hide it.
 * Tailwind v4's outline-none sets the outline style to none, so focus restores it with outline-solid.
 */
export const FOCUS_RING =
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]";

/** Scotty's status hues, from the one source: green for done, amber for in progress. */
const GREEN = catColor("closed");
const AMBER = catColor("in_progress");

const PACE: Record<Tile["pace"], { label: string; color: string }> = {
  moving: { label: "Moving", color: GREEN },
  slow: { label: "Slow", color: AMBER },
  idle: { label: "Idle", color: "var(--text-3)" },
  unknown: { label: "No activity yet", color: "var(--text-3)" },
};

/** Unknown pace on a project that has work means its whole history arrived in the bulk import. */
function paceLabel(tile: Tile): string {
  if (tile.pace === "unknown" && hasRecordedWork(tile)) return "No movement since import";
  return PACE[tile.pace].label;
}

function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      className="flex-shrink-0 rounded-full"
      style={{ background: color, width: size, height: size }}
      aria-hidden
    />
  );
}

/** Pace as a word with a dot, when it last moved, and how much finished this week. */
export function PaceLine({ tile }: { tile: Tile }) {
  const pace = PACE[tile.pace];
  return (
    <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[12px] text-[var(--text-2)]">
      <span className="inline-flex items-center gap-[6px] font-medium text-[var(--text)]">
        <Dot color={pace.color} />
        {paceLabel(tile)}
      </span>
      {tile.lastMovedAt && <span>{relTime(tile.lastMovedAt)}</span>}
      {tile.doneThisWeek > 0 && (
        <span className="tabular-nums">
          <span aria-hidden>· </span>
          {tile.doneThisWeek} done this week
        </span>
      )}
    </div>
  );
}

/**
 * The lead's moved and next lines, their age, staleness, and the last real close when it helps.
 * Moved and Next clamp to three lines; Details (clamped=false) shows them in full.
 */
export function StatusBlock({ tile, clamped }: { tile: Tile; clamped: boolean }) {
  const { status, lastClosed } = tile;
  const hasStatus = Boolean(status.moved || status.next);
  return (
    <div className="flex flex-col gap-[4px] text-[13px] leading-[1.45] [overflow-wrap:anywhere]">
      {hasStatus ? (
        <>
          {status.moved && (
            <p className={cn(clamped && "line-clamp-3")}>
              <span className="font-medium text-[var(--text-2)]">Moved: </span>
              {status.moved}
            </p>
          )}
          {status.next && (
            <p className={cn(clamped && "line-clamp-3")}>
              <span className="font-medium text-[var(--text-2)]">Next: </span>
              {status.next}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-[8px] text-[11.5px] text-[var(--text-2)]">
            <span>{status.at ? `as of ${relTime(status.at)}` : "undated"}</span>
            {status.stale && (
              <span className="inline-flex items-center gap-[5px] font-medium text-[var(--text)]">
                <Dot color={AMBER} size={6} />
                Out of date
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="text-[var(--text-2)]">No status from the lead yet</p>
      )}
      {(!hasStatus || status.stale) && lastClosed && (
        <p className="truncate text-[12px] text-[var(--text-2)]" title={lastClosed.title}>
          Last closed: {lastClosed.title}
        </p>
      )}
    </div>
  );
}

/** A lead session, opening it in the Claude desktop app. The id is validated upstream (LeadRef). */
export function LeadLink({ lead }: { lead: LeadRef }) {
  const label = lead.title ?? lead.id.slice(0, "local_".length + 8);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={lead.link}
            className={`relative z-10 inline-flex min-w-0 max-w-full items-center gap-[5px] rounded-full border border-border bg-[var(--surface-2)] px-[9px] py-[2px] text-[11.5px] font-medium text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)] ${FOCUS_RING}`}
          />
        }
      >
        <Dot color="var(--brand)" size={5} />
        <span className="truncate">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-none whitespace-nowrap font-mono">{lead.id}</TooltipContent>
    </Tooltip>
  );
}

/** Asks as plain-text links into the project, oldest first. */
export function AskList({ asks, heading }: { asks: Ask[]; heading: string }) {
  if (asks.length === 0) return null;
  return (
    <div>
      <h4 className="mb-[4px] text-[11px] font-[650] uppercase tracking-[.04em] text-[var(--text-2)]">
        {heading} <span className="tabular-nums">({asks.length})</span>
      </h4>
      <ul className="-mx-[6px] flex flex-col gap-[2px]">
        {asks.map((a) => (
          <li key={a.id}>
            <Link
              href={askHref(a.projectId, a.id)}
              className={`flex items-baseline gap-[8px] rounded-[6px] px-[6px] py-[3px] text-[12.5px] hover:bg-[var(--surface-2)] ${FOCUS_RING}`}
            >
              <span className="min-w-0 flex-1 truncate" title={a.title}>
                {a.title}
              </span>
              {a.createdAt && (
                <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--text-2)]">
                  {relTime(a.createdAt)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
