"use client";
import * as React from "react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { catColor, fmtDateTime, relTime, statusLabel } from "@/lib/beads-view";
import type { IssueRow, LeadRef, ProjectOverview } from "@/lib/overview";
import { cn } from "@/lib/utils";

/** Rows a group shows before its "Show all" toggle. */
const GROUP_PREVIEW = 5;

const enc = encodeURIComponent;
export const projectHref = (projectId: string) => `/p/${enc(projectId)}?view=focus`;
export const issueHref = (projectId: string, issueId: string) =>
  `${projectHref(projectId)}&bead=${enc(issueId)}`;

/** A lead session: its title, or a short id, linking into the Claude desktop app. */
function LeadLink({ lead }: { lead: LeadRef }) {
  const label = lead.title ?? lead.id.slice(0, "local_".length + 8);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={lead.link}
            className="inline-flex max-w-full items-center gap-[5px] rounded-full border border-border bg-[var(--surface-2)] px-[9px] py-[2px] text-[11.5px] font-medium text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          />
        }
      >
        <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--brand)]" />
        <span className="truncate">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-none whitespace-nowrap font-mono">{lead.id}</TooltipContent>
    </Tooltip>
  );
}

function ownerOf(row: IssueRow): string {
  return row.agent ?? (row.lead ? "lead" : "unassigned");
}

function IssueMeta({ row, className }: { row: IssueRow; className: string }) {
  return (
    <span
      className={cn(
        "items-center gap-x-[8px] whitespace-nowrap text-[11.5px] text-[var(--text-2)]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-[5px]">
        <span className="h-[6px] w-[6px] rounded-full" style={{ background: catColor(row.status) }} />
        {statusLabel(row.status)}
      </span>
      <span className="text-[var(--text-3)]">·</span>
      <span className={row.agent ? "font-mono text-[11px]" : "text-[var(--text-3)]"}>
        {ownerOf(row)}
      </span>
    </span>
  );
}

function IssueLine({ projectId, row }: { projectId: string; row: IssueRow }) {
  return (
    <li>
      <Link
        href={issueHref(projectId, row.id)}
        className="@container block rounded-[8px] px-[10px] py-[7px] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
      >
        <div className="flex items-baseline gap-[8px]">
          <span className="flex-shrink-0 font-mono text-[11px] text-[var(--text-3)]">{row.id}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{row.title}</span>
          {/* Status and owner sit on the title line when the card is wide enough, below it otherwise. */}
          <IssueMeta row={row} className="hidden flex-shrink-0 @xl:inline-flex" />
          <span
            title={fmtDateTime(row.updatedAt)}
            className="w-[52px] flex-shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-[var(--text-3)]"
          >
            {relTime(row.updatedAt)}
          </span>
        </div>
        <IssueMeta row={row} className="mt-[2px] flex @xl:hidden" />
        {row.latestNote && (
          <div className="mt-[2px] truncate text-[12px] text-[var(--text-3)]">{row.latestNote}</div>
        )}
      </Link>
    </li>
  );
}

function IssueGroup({
  label,
  projectId,
  rows,
}: {
  label: string;
  projectId: string;
  rows: IssueRow[];
}) {
  // View state only: which groups are expanded resets on reload.
  const [expanded, setExpanded] = React.useState(false);
  if (rows.length === 0) return null;
  // Rows arrive newest first, so the collapsed group is its most recent few.
  const shown = expanded ? rows : rows.slice(0, GROUP_PREVIEW);
  return (
    <section className="mt-[10px] first:mt-0">
      <h3 className="px-[10px] pb-[2px] text-[10.5px] font-[650] uppercase tracking-[.04em] text-[var(--text-3)]">
        {label} <span className="tabular-nums">{rows.length}</span>
      </h3>
      <ul>
        {shown.map((row) => (
          <IssueLine key={row.id} projectId={projectId} row={row} />
        ))}
      </ul>
      {rows.length > GROUP_PREVIEW && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="ml-[10px] mt-[2px] rounded-[6px] py-[3px] text-[12px] font-medium text-[var(--brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {expanded ? `Show ${GROUP_PREVIEW} most recent` : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

/** One project: its leads, then what needs you, what is in flight and what is blocked. */
export function ProjectCard({ project }: { project: ProjectOverview }) {
  if (project.state === "not-on-beads") {
    return (
      <div className="px-[14px] py-[6px] text-[12.5px] text-[var(--text-3)]">
        <span className="font-medium">{project.name}</span> · not on Beads
      </div>
    );
  }

  const idle = project.inFlight.length === 0 && project.blocked.length === 0;
  return (
    <article className="rounded-[12px] border border-border bg-[var(--surface)] p-[6px] shadow-[var(--shadow)]">
      <header className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] px-[10px] pb-[6px] pt-[8px]">
        <Link
          href={projectHref(project.id)}
          className="text-[14px] font-[650] tracking-[-.01em] hover:text-[var(--brand)]"
        >
          {project.name}
        </Link>
        {project.leads.map((lead) => (
          <LeadLink key={lead.id} lead={lead} />
        ))}
      </header>

      {project.state === "error" ? (
        <p className="break-words px-[10px] pb-[8px] text-[12.5px] text-[var(--destructive)]">
          Could not read this project: {project.error ?? "unknown error"}
        </p>
      ) : (
        <div className="pb-[4px]">
          <IssueGroup label="Needs you" projectId={project.id} rows={project.needsYou} />
          <IssueGroup label="In flight" projectId={project.id} rows={project.inFlight} />
          <IssueGroup label="Blocked" projectId={project.id} rows={project.blocked} />
          {idle && (
            <p className="px-[10px] py-[6px] text-[12.5px] text-[var(--text-3)]">
              Nothing in flight
              {project.lastActivity ? (
                <span title={fmtDateTime(project.lastActivity)}>
                  {" "}
                  · last activity {relTime(project.lastActivity)}
                </span>
              ) : project.activityState === "unavailable" ? (
                " · activity unavailable"
              ) : (
                " · no activity in the last 24 hours"
              )}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
