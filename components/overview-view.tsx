"use client";
import * as React from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { ProjectCard } from "@/components/overview/project-card";
import { useOverview } from "@/hooks/use-overview";
import { fmtDateTime } from "@/lib/beads-view";
import type { Overview } from "@/lib/overview";

/** "updated 12s ago", ticking once a second without re-rendering the lists. */
function UpdatedAgo({ at }: { at: string }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return null;
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  const text = s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  return <span title={fmtDateTime(at)}>updated {text}</span>;
}

const TOTALS: { key: keyof Overview["totals"]; label: string; color: string }[] = [
  { key: "inFlight", label: "In flight", color: "#d97706" },
  { key: "blocked", label: "Blocked", color: "#ef4444" },
  { key: "needsYou", label: "Needs you", color: "var(--brand)" },
  { key: "closed24h", label: "Closed (24h)", color: "#16a34a" },
];

function TotalsStrip({ totals }: { totals: Overview["totals"] | null }) {
  return (
    <dl className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
      {TOTALS.map((t) => (
        <div
          key={t.key}
          className="rounded-[12px] border border-border bg-[var(--surface)] px-[14px] py-[11px] shadow-[var(--shadow)]"
        >
          <dt className="flex items-center gap-[6px] text-[11.5px] font-medium text-[var(--text-2)]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: t.color }} />
            {t.label}
          </dt>
          <dd className="mt-[3px] text-[24px] font-[650] leading-[1.15] tracking-[-.02em] tabular-nums">
            {totals ? totals[t.key] : <Skeleton className="mt-[4px] h-[24px] w-[42px]" />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-[10px] text-[12px] font-[650] uppercase tracking-[.04em] text-[var(--text-3)]">
      {children}
    </h2>
  );
}

function LoadingColumns() {
  return (
    <>
      <div className="flex flex-col gap-[12px]">
        {[112, 148, 96].map((h) => (
          <Skeleton key={h} className="w-full rounded-[12px]" style={{ height: h }} />
        ))}
      </div>
      <div className="flex flex-col gap-[10px]">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-[44px] w-full rounded-[8px]" />
        ))}
      </div>
    </>
  );
}

/**
 * Cross-project overview: everything in flight, who is on it and what just
 * happened. Read-only; every row links into that project's Focus view.
 */
export function OverviewView() {
  const { data, error, isPending, isFetching, refetch } = useOverview();
  const failed = !data && error;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-[12px] border-b border-border px-[16px] py-[14px] sm:px-[28px]">
        <Link
          href="/"
          title="All projects"
          aria-label="All projects"
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] text-white"
          style={{ background: "var(--brand)", boxShadow: "0 2px 8px -2px var(--brand)" }}
        >
          <Icon name="logo" size={19} />
        </Link>
        <div className="min-w-0 flex-1 leading-[1.2]">
          <h1 className="text-[16px] font-[680] tracking-[-.01em]">Overview</h1>
          <div className="truncate text-[12px] text-[var(--text-3)]">
            {data ? (
              <>
                <UpdatedAgo at={data.generatedAt} />
                {error ? " · last refresh failed" : ""}
              </>
            ) : failed ? (
              "could not load"
            ) : (
              "loading"
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh overview"
        >
          <RefreshCw className={isFetching ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </header>

      {failed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[12px] p-[28px] text-center">
          <div className="text-[15px] font-[650]">The overview could not be loaded</div>
          <p className="max-w-[460px] break-words text-[13px] text-[var(--text-2)]">{error.message}</p>
          <Button onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </div>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <div className="px-[16px] pt-[16px] sm:px-[28px] sm:pt-[20px]">
            <TotalsStrip totals={data?.totals ?? null} />
          </div>
          <div className="grid gap-x-[24px] gap-y-[24px] px-[16px] pt-[20px] sm:px-[28px] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {isPending || !data ? (
              <LoadingColumns />
            ) : (
              <>
                <section aria-label="Projects" className="pb-[24px] lg:min-h-0 lg:overflow-y-auto lg:pr-[4px]">
                  <ColumnHeading>Projects</ColumnHeading>
                  {data.projects.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-3)]">
                      No projects yet. Add one from{" "}
                      <Link href="/" className="text-[var(--brand)] hover:underline">
                        All projects
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="flex flex-col gap-[12px]">
                      {data.projects.map((p) => (
                        <ProjectCard key={p.id} project={p} />
                      ))}
                    </div>
                  )}
                </section>
                <section aria-label="Activity" className="pb-[24px] lg:min-h-0 lg:overflow-y-auto lg:pr-[4px]">
                  <ColumnHeading>Activity, last 24 hours</ColumnHeading>
                  <ActivityFeed items={data.activity} projects={data.projects} />
                </section>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
