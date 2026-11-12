"use client";
import * as React from "react";
import Link from "next/link";
import { relTime } from "@/lib/beads-view";
import type { TopAsk } from "@/lib/overview";
import { AnswerScopeProvider, useAnswerScopeRoot } from "@/components/home/answer-scope";
import { AnswerRow, useOpenAsk } from "@/components/home/ask-list";
import { FOCUS_RING, askHref } from "@/components/home/tile-parts";
import { cn } from "@/lib/utils";

/** "asked 3d ago" reads as "waiting 3d"; a brand-new ask reads as "new". */
function waited(createdAt: string): string {
  const rel = relTime(createdAt);
  return rel === "just now" ? "new" : `waiting ${rel.replace(/ ago$/, "")}`;
}

const askKey = (a: TopAsk) => `${a.projectId}:${a.id}`;

/**
 * At most one line per project: the ask its lead says is holding it up, with its Answer
 * button beside the link. Wide: project, ask, wait on one line. Narrow: project and wait
 * above the ask. One answer box open at a time, full width under its line.
 */
export function NeedsNow({ asks, canAnswer }: { asks: TopAsk[]; canAnswer: boolean }) {
  const box = useOpenAsk(canAnswer ? asks.map(askKey) : []);
  const { ref, scope } = useAnswerScopeRoot<TopAsk[], HTMLElement>(asks);
  return (
    <AnswerScopeProvider value={scope}>
      <section
        ref={ref}
        aria-labelledby="needs-now"
        data-answer-list=""
        className="rounded-[14px] border border-border bg-[var(--surface)] p-[14px_16px] shadow-[var(--shadow)]"
      >
        <h2
          id="needs-now"
          tabIndex={-1}
          data-answer-heading=""
          className={cn(
            "w-fit rounded-[4px] text-[17px] font-[650] leading-[1.25] tracking-[-.015em] text-[var(--text)]",
            FOCUS_RING,
            "focus-visible:outline-offset-2",
          )}
        >
          Needs you now
        </h2>
        {asks.length === 0 ? (
          <p className="mt-[6px] text-[13px] text-[var(--text-2)]">Nothing needs you right now.</p>
        ) : (
          <ul className="-mx-[6px] mt-[8px] flex flex-col gap-[2px]">
            {asks.map((a) => (
              <AnswerRow
                key={askKey(a)}
                projectId={a.projectId}
                issueId={a.id}
                label={a.text}
                canAnswer={canAnswer}
                open={box.isOpen(askKey(a))}
                onOpen={() => box.open(askKey(a))}
                onClose={box.close}
              >
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
              </AnswerRow>
            ))}
          </ul>
        )}
      </section>
    </AnswerScopeProvider>
  );
}
