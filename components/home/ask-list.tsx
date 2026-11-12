"use client";
import * as React from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBox } from "@/components/home/answer-box";
import { useAnswerScope } from "@/components/home/answer-scope";
import { FOCUS_RING, askHref } from "@/components/home/tile-parts";
import { catColor, relTime } from "@/lib/beads-view";
import type { AnsweredAsk, Ask } from "@/lib/overview";
import { cn } from "@/lib/utils";

/** "answered 5m ago"; a missing or unreadable time reads as plain "answered". */
function answeredLabel(at: string | null): string {
  return at && Number.isFinite(Date.parse(at)) ? `answered ${relTime(at)}` : "answered";
}

/**
 * One ask line with its Answer button beside the link, never inside it. Open, the line
 * takes a quiet fill and the box opens under it; closing by Cancel or Escape hands focus
 * back to the Answer button. After a send, the enclosing scope places focus and announces.
 */
export function AnswerRow({
  projectId,
  issueId,
  label,
  canAnswer,
  open,
  onOpen,
  onClose,
  below,
  children,
}: {
  projectId: string;
  issueId: string;
  label: string;
  canAnswer: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  below?: React.ReactNode;
  children: React.ReactNode;
}) {
  const row = React.useRef<HTMLLIElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const scope = useAnswerScope();
  const expanded = open && canAnswer;
  const close = () => {
    flushSync(onClose);
    button.current?.focus();
  };
  const sent = () => {
    const li = row.current;
    flushSync(onClose);
    scope.sent(li);
  };

  return (
    <li ref={row} className={cn("rounded-[8px]", expanded && "bg-[var(--surface-2)] pb-[8px]")}>
      <div className="flex items-center gap-[8px] pr-[6px]">
        <div className="min-w-0 flex-1">{children}</div>
        {canAnswer && !open && (
          <Button
            ref={button}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Answer: ${label}`}
            data-answer-button=""
            onClick={onOpen}
          >
            Answer
          </Button>
        )}
      </div>
      {below}
      {expanded && (
        <div className="px-[6px]">
          <AnswerBox projectId={projectId} issueId={issueId} ask={label} onClose={close} onSent={sent} />
        </div>
      )}
    </li>
  );
}

/**
 * One open box per list: the key of the ask being answered, if any. A line that leaves the
 * list, or every line while Answer is unavailable (viewer mode), closes its box, so it comes
 * back closed and never steals focus; its draft is kept by the box's draft store.
 */
export function useOpenAsk(keys: readonly string[]) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  if (openKey !== null && !keys.includes(openKey)) setOpenKey(null);
  return {
    isOpen: (key: string) => openKey === key,
    open: (key: string) => setOpenKey(key),
    close: () => setOpenKey(null),
  };
}

/** A list's heading; after a send it can take focus when no next row is left. */
function ListHeading({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h4
      tabIndex={-1}
      data-answer-heading=""
      className={cn(
        "mb-[4px] w-fit rounded-[4px] text-[11px] font-[650] uppercase tracking-[.04em] text-[var(--text-2)]",
        FOCUS_RING,
        "focus-visible:outline-offset-2",
      )}
    >
      {children} <span className="tabular-nums">({count})</span>
    </h4>
  );
}

const ROW_LINK = `flex items-baseline gap-[8px] rounded-[6px] px-[6px] py-[4px] text-[12.5px] hover:bg-[var(--surface-2)] ${FOCUS_RING}`;

/** Asks as plain-text links into the project, oldest first, each with its Answer button. */
export function AskList({ asks, heading, canAnswer }: { asks: Ask[]; heading: string; canAnswer: boolean }) {
  const box = useOpenAsk(canAnswer ? asks.map((a) => a.id) : []);
  if (asks.length === 0) return null;
  return (
    <div data-answer-list="">
      <ListHeading count={asks.length}>{heading}</ListHeading>
      <ul className="-mx-[6px] flex flex-col gap-[2px]">
        {asks.map((a) => (
          <AnswerRow
            key={a.id}
            projectId={a.projectId}
            issueId={a.id}
            label={a.title}
            canAnswer={canAnswer}
            open={box.isOpen(a.id)}
            onOpen={() => box.open(a.id)}
            onClose={box.close}
          >
            <Link href={askHref(a.projectId, a.id)} className={ROW_LINK}>
              <span className="line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere]" title={a.title}>
                {a.title}
              </span>
              {a.createdAt && (
                <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--text-2)]">
                  {relTime(a.createdAt)}
                </span>
              )}
            </Link>
          </AnswerRow>
        ))}
      </ul>
    </div>
  );
}

/**
 * Asks Esteban has answered that the lead has not acted on, newest answer first: a check,
 * the title, when he answered, and his latest answer quoted below. Each can be answered again.
 */
export function AnsweredList({ asks, canAnswer }: { asks: AnsweredAsk[]; canAnswer: boolean }) {
  const box = useOpenAsk(canAnswer ? asks.map((a) => a.id) : []);
  if (asks.length === 0) return null;
  return (
    <div data-answer-list="">
      <ListHeading count={asks.length}>Answered, waiting for the lead</ListHeading>
      <ul className="-mx-[6px] flex flex-col gap-[2px]">
        {asks.map((a) => (
          <AnswerRow
            key={a.id}
            projectId={a.projectId}
            issueId={a.id}
            label={a.title}
            canAnswer={canAnswer}
            open={box.isOpen(a.id)}
            onOpen={() => box.open(a.id)}
            onClose={box.close}
            below={
              a.answer && (
                <p className="mb-[4px] ml-[28px] mr-[6px] whitespace-pre-line border-l-2 border-[var(--border-strong)] pl-[10px] text-[12.5px] leading-[1.45] text-[var(--text-2)] [overflow-wrap:anywhere]">
                  {a.answer}
                </p>
              )
            }
          >
            <Link href={askHref(a.projectId, a.id)} className={ROW_LINK}>
              <Check
                size={14}
                strokeWidth={2.25}
                aria-hidden
                className="flex-shrink-0 translate-y-[2px]"
                style={{ color: catColor("closed") }}
              />
              <span className="line-clamp-2 min-w-0 flex-1 text-[var(--text-2)] [overflow-wrap:anywhere]" title={a.title}>
                {a.title}
              </span>
              <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--text-2)]">
                {answeredLabel(a.answeredAt)}
              </span>
            </Link>
          </AnswerRow>
        ))}
      </ul>
    </div>
  );
}
