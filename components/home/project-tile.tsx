"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnswerScopeProvider, useAnswerScopeRoot } from "@/components/home/answer-scope";
import { AnsweredList, AskList } from "@/components/home/ask-list";
import { PhaseMeter } from "@/components/home/phase-meter";
import { FOCUS_RING, LeadLink, PaceLine, StatusBlock, boardHref } from "@/components/home/tile-parts";
import { catColor } from "@/lib/beads-view";
import type { Tile } from "@/lib/overview";
import { cn } from "@/lib/utils";

const SHOWN_PHASES = 2;

const TILE =
  "relative rounded-[14px] border border-border bg-[var(--surface)] p-[16px] shadow-[var(--shadow)] transition-[border-color] duration-150 hover:border-[var(--border-strong)]";

/**
 * The name's link, stretched over the whole tile so a click anywhere opens the
 * board. Its focus ring is drawn on the stretched layer, around the tile.
 */
function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="outline-none after:absolute after:-inset-px after:rounded-[14px] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-[var(--brand)]"
    >
      {children}
    </Link>
  );
}

type Clause = { key: string; text: string; color?: string };

/**
 * "2 questions open · 1 answered · 1 waiting", the answered clause in Scotty's green; a zero
 * clause is dropped, and all zero says nothing.
 */
function QuestionsLine({ open, answered, waiting }: { open: number; answered: number; waiting: number }) {
  const clauses: Clause[] = [];
  if (open > 0) clauses.push({ key: "open", text: `${open} ${open === 1 ? "question" : "questions"} open` });
  if (answered > 0) clauses.push({ key: "answered", text: `${answered} answered`, color: catColor("closed") });
  if (waiting > 0) clauses.push({ key: "waiting", text: `${waiting} waiting` });
  if (clauses.length === 0) return null;
  return (
    <span className="tabular-nums">
      {clauses.map((c, i) => (
        <React.Fragment key={c.key}>
          {i > 0 && (
            <>
              <span aria-hidden> · </span>
              <span className="sr-only">, </span>
            </>
          )}
          <span className={cn(c.color && "font-[600]")} style={c.color ? { color: c.color } : undefined}>
            {c.text}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

/** A region that grows from zero height; the negative top margin cancels its column gap while closed. */
function Reveal({ id, open, className, children }: { id: string; open: boolean; className: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        className,
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * One project. Details, the ask links and the lead link sit above the
 * stretched name link as their own controls; nothing interactive is nested in
 * another control. Details grows the tile downward in place.
 */
export function ProjectTile({ tile, canAnswer }: { tile: Tile; canAnswer: boolean }) {
  const [open, setOpen] = React.useState(false);
  const phasesId = React.useId();
  const asksId = React.useId();
  const { ref, scope } = useAnswerScopeRoot<Tile, HTMLElement>(tile);
  const board = boardHref(tile.id);

  if (tile.state !== "ok") {
    return (
      <article className={TILE}>
        <h3 className="text-[17px] font-[650] leading-[1.25] tracking-[-.015em] [overflow-wrap:anywhere]">
          <TileLink href={board}>{tile.name}</TileLink>
        </h3>
        <p className="mt-[6px] text-[12.5px] text-[var(--text-2)] [overflow-wrap:anywhere]">
          {tile.state === "not-on-beads"
            ? "Not on Beads"
            : `Could not read this project: ${tile.error ?? "unknown error"}`}
        </p>
      </article>
    );
  }

  const shown = tile.phases.slice(0, SHOWN_PHASES);
  const hidden = tile.phases.slice(SHOWN_PHASES);
  const asks = tile.asksOpen.length + tile.asksAnswered.length + tile.asksWaiting.length;
  // Details reveals hidden phases in place, the full status, and the asks below the footer.
  const showAsks = asks > 0 || hidden.length === 0;
  const controls = [hidden.length > 0 && phasesId, showAsks && asksId].filter(Boolean).join(" ");

  return (
    <AnswerScopeProvider value={scope}>
      <article ref={ref} className={cn(TILE, "flex flex-col gap-[12px]")}>
        <header className="flex flex-col gap-[3px]">
          <h3 className="text-[17px] font-[650] leading-[1.25] tracking-[-.015em] [overflow-wrap:anywhere]">
            <TileLink href={board}>{tile.name}</TileLink>
          </h3>
          <PaceLine tile={tile} />
        </header>

        <div className="flex flex-col gap-[10px]">
          {tile.phases.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-2)]">No phases set</p>
          ) : (
            shown.map((p) => <PhaseMeter key={p.id} phase={p} />)
          )}
          {hidden.length > 0 && (
            <Reveal id={phasesId} open={open} className="-mt-[10px]">
              <div className="flex flex-col gap-[10px] pt-[10px]">
                {hidden.map((p) => (
                  <PhaseMeter key={p.id} phase={p} />
                ))}
              </div>
            </Reveal>
          )}
          {hidden.length > 0 && !open && (
            <p className="text-[11.5px] text-[var(--text-2)]">
              +{hidden.length} more {hidden.length === 1 ? "phase" : "phases"}
            </p>
          )}
        </div>

        <StatusBlock tile={tile} clamped={!open} />

        <footer className="flex flex-wrap items-center gap-[8px] border-t border-border pt-[10px] text-[12px] text-[var(--text-2)]">
          <QuestionsLine
            open={tile.asksOpen.length}
            answered={tile.asksAnswered.length}
            waiting={tile.asksWaiting.length}
          />
          {tile.lead && <LeadLink lead={tile.lead} />}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={controls}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "relative z-10 ml-auto inline-flex items-center gap-[4px] rounded-[7px] px-[8px] py-[3px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] aria-expanded:text-[var(--text)]",
              FOCUS_RING,
            )}
          >
            Details
            <ChevronDown
              size={14}
              aria-hidden
              className={cn(
                "transition-transform duration-200 ease-out motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </footer>

        {showAsks && (
          // The clip box reaches 8px past the content on the sides and 4px below, so button focus rings show.
          <Reveal id={asksId} open={open} className="relative z-10 -mx-[8px] -mt-[12px]">
            <div className="px-[8px] pb-[4px]">
              <div className="mt-[12px] flex flex-col gap-[14px] border-t border-border pt-[12px]">
                <AnsweredList asks={tile.asksAnswered} canAnswer={canAnswer} />
                <AskList asks={tile.asksOpen} heading="Open questions" canAnswer={canAnswer} />
                <AskList asks={tile.asksWaiting} heading="Waiting on other work" canAnswer={canAnswer} />
                {asks === 0 && <p className="text-[12.5px] text-[var(--text-2)]">No more phases and no questions.</p>}
              </div>
            </div>
          </Reveal>
        )}
      </article>
    </AnswerScopeProvider>
  );
}
