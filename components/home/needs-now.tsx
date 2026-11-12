import Link from "next/link";
import { relTime } from "@/lib/beads-view";
import type { TopAsk } from "@/lib/overview";
import { FOCUS_RING, askHref } from "@/components/home/tile-parts";

/** "asked 3d ago" reads as "waiting 3d"; a brand-new ask reads as "new". */
function waited(createdAt: string): string {
  const rel = relTime(createdAt);
  return rel === "just now" ? "new" : `waiting ${rel.replace(/ ago$/, "")}`;
}

/**
 * At most one line per project: the ask its lead says is holding it up.
 * Wide: project, ask, wait on one line. Narrow: project and wait above the ask.
 */
export function NeedsNow({ asks }: { asks: TopAsk[] }) {
  return (
    <section
      aria-labelledby="needs-now"
      className="rounded-[14px] border border-border bg-[var(--surface)] p-[14px_16px] shadow-[var(--shadow)]"
    >
      <h2
        id="needs-now"
        className="text-[17px] font-[650] leading-[1.25] tracking-[-.015em] text-[var(--text)]"
      >
        Needs you now
      </h2>
      {asks.length === 0 ? (
        <p className="mt-[6px] text-[13px] text-[var(--text-2)]">Nothing needs you right now.</p>
      ) : (
        <ul className="-mx-[6px] mt-[8px] flex flex-col gap-[2px]">
          {asks.map((a) => (
            <li key={`${a.projectId}:${a.id}`}>
              <Link
                href={askHref(a.projectId, a.id)}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-[12px] gap-y-[2px] rounded-[8px] px-[6px] py-[5px] hover:bg-[var(--surface-2)] sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] ${FOCUS_RING}`}
              >
                <span className="truncate text-[12px] font-[600] text-[var(--text-2)]">
                  {a.projectName}
                </span>
                <span className="col-span-2 row-start-2 text-[13.5px] leading-[1.4] [overflow-wrap:anywhere] sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  {a.text}
                </span>
                {a.createdAt && (
                  <span className="col-start-2 row-start-1 whitespace-nowrap text-[11.5px] tabular-nums text-[var(--text-2)] sm:col-start-3">
                    {waited(a.createdAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
