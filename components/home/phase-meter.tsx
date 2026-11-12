import type { Phase } from "@/lib/overview";

/** One phase: title, "done of total" and a bar. Screen readers get the same numbers. */
export function PhaseMeter({ phase }: { phase: Phase }) {
  const pct = phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;
  const amount = phase.total > 0 ? `${phase.done} of ${phase.total}` : "no work filed";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-[10px] text-[12.5px] leading-[1.3]">
        <span className="truncate text-[var(--text)]" title={phase.title}>
          {phase.title}
        </span>
        <span className="flex-shrink-0 tabular-nums text-[var(--text-2)]">{amount}</span>
      </div>
      <div
        role="progressbar"
        aria-label={phase.title}
        aria-valuemin={0}
        aria-valuemax={phase.total > 0 ? phase.total : undefined}
        aria-valuenow={phase.total > 0 ? phase.done : undefined}
        aria-valuetext={phase.total > 0 ? `${amount} done` : amount}
        className="mt-[6px] h-[6px] overflow-hidden rounded-full bg-[var(--surface-3)]"
      >
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
