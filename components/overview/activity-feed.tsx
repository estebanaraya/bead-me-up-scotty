"use client";
import Link from "next/link";
import { fmtDateTime, relTime } from "@/lib/beads-view";
import type { ActivityItem, ProjectOverview } from "@/lib/overview";
import { issueHref } from "@/components/overview/project-card";

const KIND_COLORS: Record<string, string> = {
  created: "#3b82f6",
  claimed: "#d97706",
  dispatched: "#d97706",
  reopened: "#d97706",
  closed: "#16a34a",
};

function FeedRow({ item }: { item: ActivityItem }) {
  return (
    <li>
      <Link
        href={issueHref(item.projectId, item.issueId)}
        className="block rounded-[8px] px-[10px] py-[7px] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
      >
        <div className="flex flex-wrap items-baseline gap-x-[8px] text-[12px]">
          <span
            title={fmtDateTime(item.at)}
            className="whitespace-nowrap text-[11px] tabular-nums text-[var(--text-3)]"
          >
            {relTime(item.at)}
          </span>
          <span className="font-medium text-[var(--text-2)]">{item.projectName}</span>
          <span className="inline-flex items-center gap-[5px] font-semibold">
            <span
              className="h-[6px] w-[6px] rounded-full"
              style={{ background: KIND_COLORS[item.kind] ?? "var(--text-3)" }}
            />
            {item.kind}
          </span>
          <span className="ml-auto text-[11px] text-[var(--text-3)]">{item.actor}</span>
        </div>
        <div className="mt-[2px] flex items-baseline gap-[8px]">
          <span className="flex-shrink-0 font-mono text-[11px] text-[var(--text-3)]">
            {item.issueId}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.title ?? "(deleted issue)"}</span>
        </div>
        {item.detail && (
          <div className="mt-[2px] truncate text-[12px] text-[var(--text-3)]">{item.detail}</div>
        )}
      </Link>
    </li>
  );
}

/** The last 24 hours across every project, newest first. */
export function ActivityFeed({
  items,
  projects,
}: {
  items: ActivityItem[];
  projects: ProjectOverview[];
}) {
  const unavailable = projects.filter((p) => p.activityState === "unavailable");
  return (
    <div>
      {items.length === 0 ? (
        <p className="px-[10px] py-[18px] text-[13px] text-[var(--text-3)]">
          No activity in the last 24 hours.
        </p>
      ) : (
        <ol>
          {items.map((item, i) => (
            <FeedRow key={`${item.projectId}:${item.issueId}:${item.at}:${item.kind}:${i}`} item={item} />
          ))}
        </ol>
      )}
      <p className="mt-[10px] border-t border-border px-[10px] pt-[10px] text-[11.5px] leading-[1.5] text-[var(--text-3)]">
        Shows changes written on this PC in the last 24 hours (newest 200). Changes that arrive by
        sync from another machine do not appear.
      </p>
      {unavailable.map((p) => (
        <p key={p.id} className="px-[10px] pt-[4px] text-[11.5px] text-[var(--text-3)]">
          Activity unavailable for {p.name}
        </p>
      ))}
    </div>
  );
}
