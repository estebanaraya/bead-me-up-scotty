"use client";
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Launcher } from "@/components/launcher";
import { useCanAnswer } from "@/components/home/answer-box";
import { NeedsNow } from "@/components/home/needs-now";
import { ProjectTile } from "@/components/home/project-tile";
import { ProjectsMenu } from "@/components/home/projects-menu";
import { useOverview } from "@/hooks/use-overview";
import { fmtDateTime, relTime } from "@/lib/beads-view";

const GRID = "grid grid-cols-1 items-start gap-[14px] sm:grid-cols-2 lg:grid-cols-3";

/** "updated 12s ago", ticking once a second without re-rendering the tiles. */
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
  const text = s < 5 ? "just now" : s < 60 ? `${s}s ago` : relTime(at, new Date(now));
  return <span title={fmtDateTime(at)}>updated {text}</span>;
}

const SHELL = "rounded-[14px] border border-border bg-[var(--surface)] shadow-[var(--shadow)]";

/**
 * The strip and the tiles as empty shells at their typical loaded heights (five asks; a
 * tile with two phases, a status and a footer: 360px), so nothing jumps when data lands.
 */
function Loading() {
  return (
    <div className="flex flex-col gap-[18px]" aria-busy="true">
      <span className="sr-only">Loading projects</span>
      <div className={`${SHELL} flex h-[425px] flex-col gap-[14px] p-[14px_16px] sm:h-[269px] lg:h-[212px]`}>
        <Skeleton className="h-[18px] w-[150px]" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[16px] w-full max-w-[720px]" />
        ))}
      </div>
      <div className={GRID}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${SHELL} flex h-[360px] flex-col gap-[12px] p-[16px]`}>
            <Skeleton className="h-[20px] w-[45%]" />
            <Skeleton className="h-[12px] w-[60%]" />
            <Skeleton className="mt-[8px] h-[30px] w-full" />
            <Skeleton className="h-[30px] w-full" />
            <Skeleton className="mt-[8px] h-[54px] w-full" />
            <Skeleton className="h-[54px] w-full" />
            <Skeleton className="mt-auto h-[16px] w-[50%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Scotty's home: what needs Esteban, then every project's progress in plain terms. Its one
 * write is an answer to an ask, offered only outside viewer mode.
 */
export function HomeView() {
  const { data, error, isPending, isFetching, refetch } = useOverview();
  const canAnswer = useCanAnswer();
  const failed = !data && error;

  if (data && data.projects.length === 0) return <Launcher />;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-[10px] border-b border-border px-[16px] py-[14px] sm:gap-[12px] sm:px-[28px]">
        <div
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] text-white"
          style={{ background: "var(--brand)", boxShadow: "0 2px 8px -2px var(--brand)" }}
          aria-hidden
        >
          <Icon name="logo" size={19} />
        </div>
        <div className="min-w-0 flex-1 leading-[1.2]">
          <h1 className="text-[16px] font-[680] tracking-[-.01em]">Overview</h1>
          <div className="truncate text-[12px] text-[var(--text-2)]">
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
        <ProjectsMenu projects={data?.projects ?? []} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh overview"
        >
          <RefreshCw
            className={isFetching ? "animate-spin motion-reduce:animate-none" : undefined}
            aria-hidden
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </header>

      {failed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[12px] p-[28px] text-center">
          <h2 className="text-[15px] font-[650]">The overview could not be loaded</h2>
          <p className="max-w-[460px] break-words text-[13px] text-[var(--text-2)]">{error.message}</p>
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying" : "Retry"}
          </Button>
        </div>
      ) : (
        <main className="bd-scroll flex-1 overflow-y-auto px-[16px] py-[18px] sm:px-[28px] sm:py-[22px]">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-[18px]">
            {isPending || !data ? (
              <Loading />
            ) : (
              <>
                <NeedsNow asks={data.needsNow} canAnswer={canAnswer} />
                <h2 id="home-projects" className="sr-only">
                  Projects
                </h2>
                <section aria-labelledby="home-projects" className={GRID}>
                  {data.projects.map((t) => (
                    <ProjectTile key={t.id} tile={t} canAnswer={canAnswer} />
                  ))}
                </section>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
