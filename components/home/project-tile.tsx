"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PhaseMeter } from "@/components/home/phase-meter";
import {
  AskList,
  FOCUS_RING,
  LeadLink,
  PaceLine,
  StatusBlock,
  boardHref,
} from "@/components/home/tile-parts";
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

function questionsLine(open: number, waiting: number): string | null {
  if (open + waiting === 0) return null;
  const head = `${open} ${open === 1 ? "question" : "questions"} open`;
  return waiting > 0 ? `${head}, ${waiting} waiting` : head;
}

/**
 * One project. Details, the ask links and the lead link sit above the
 * stretched name link as their own controls; nothing interactive is nested in
 * another control. Details grows the tile downward in place.
 */
export function ProjectTile({ tile }: { tile: Tile }) {
  const [open, setOpen] = React.useState(false);
  const detailsId = React.useId();
  const board = boardHref(tile.id);

  if (tile.state !== "ok") {
    return (
      <article className={TILE}>
        <h3 className="text-[15px] font-[650] tracking-[-.01em] [overflow-wrap:anywhere]">
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
  const asks = tile.asksOpen.length + tile.asksWaiting.length;
  const questions = questionsLine(tile.asksOpen.length, tile.asksWaiting.length);

  return (
    <article className={cn(TILE, "flex flex-col gap-[12px]")}>
      <header className="flex flex-col gap-[3px]">
        <h3 className="text-[15px] font-[650] tracking-[-.01em] [overflow-wrap:anywhere]">
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
        {hidden.length > 0 && !open && (
          <p className="text-[11.5px] text-[var(--text-2)]">
            +{hidden.length} more {hidden.length === 1 ? "phase" : "phases"}
          </p>
        )}
      </div>

      <StatusBlock tile={tile} />

      <footer className="flex flex-wrap items-center gap-[8px] border-t border-border pt-[10px] text-[12px] text-[var(--text-2)]">
        {questions && <span className="tabular-nums">{questions}</span>}
        {tile.lead && <LeadLink lead={tile.lead} />}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
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

      {/* Grows from zero height; the negative margin cancels the column gap while closed. */}
      <div
        id={detailsId}
        inert={!open}
        className={cn(
          "relative z-10 -mt-[12px] grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-[12px] flex flex-col gap-[14px] border-t border-border pt-[12px]">
            {hidden.length > 0 && (
              <div className="flex flex-col gap-[10px]">
                {hidden.map((p) => (
                  <PhaseMeter key={p.id} phase={p} />
                ))}
              </div>
            )}
            <AskList asks={tile.asksOpen} heading="Open questions" />
            <AskList asks={tile.asksWaiting} heading="Waiting on other work" />
            {asks === 0 && hidden.length === 0 && (
              <p className="text-[12.5px] text-[var(--text-2)]">No more phases and no questions.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
