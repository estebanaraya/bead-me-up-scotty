"use client";
import * as React from "react";

/**
 * Where focus and the announcement go after an answer is sent. The home owns one polite
 * live region; each answering surface (the strip, a tile) is a scope that keeps focus on
 * the page when the answered line leaves its list.
 */

/** `row` is null when the answered line already left the page before the send returned. */
type Scope = { sent: (row: HTMLElement | null) => void };

const Announce = React.createContext<(message: string) => void>(() => {});
const ScopeContext = React.createContext<Scope | null>(null);

/*
 * Markup contract: a list wrapper carries `data-answer-list`, the heading that names it
 * `data-answer-heading` with `tabIndex={-1}`, and each row's Answer button
 * `data-answer-button`.
 */

/** The home's polite live region, announcing "Answer saved" after each send. */
export function AnswerAnnouncer({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState("");
  const frame = React.useRef(0);
  const announce = React.useCallback((next: string) => {
    // Clear first, so the same message twice is announced twice.
    setMessage("");
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setMessage(next));
  }, []);
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (
    <Announce.Provider value={announce}>
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </Announce.Provider>
  );
}

function focusable(el: Element | null | undefined): el is HTMLElement {
  return el instanceof HTMLElement && el.isConnected;
}

const lost = () => !document.activeElement || document.activeElement === document.body;

/**
 * One answering surface (the strip, a tile): put `ref` on its root and `scope` in an
 * AnswerScopeProvider. `data` is what the surface renders from. After a send, focus moves
 * to the next row's Answer button, else the list's heading; if that list then vanishes when
 * the refetch lands (`data` changes and focus fell to the page), focus moves to the
 * scope's first answer heading, else its first link.
 */
export function useAnswerScopeRoot<T, E extends HTMLElement>(data: T) {
  const ref = React.useRef<E | null>(null);
  const latest = React.useRef(data);
  const pending = React.useRef<{ data: T } | null>(null);
  const announce = React.useContext(Announce);

  const recover = React.useCallback(() => {
    if (!lost()) return;
    const root = ref.current;
    const target = root?.querySelector("[data-answer-heading]") ?? root?.querySelector("a[href]");
    if (focusable(target)) target.focus();
  }, []);

  React.useEffect(() => {
    latest.current = data;
    if (!pending.current || pending.current.data === data) return;
    pending.current = null;
    recover();
  });

  const scope = React.useMemo<Scope>(
    () => ({
      sent: (row) => {
        const next = row?.nextElementSibling?.querySelector("[data-answer-button]");
        const heading = row?.closest("[data-answer-list]")?.querySelector("[data-answer-heading]");
        const target = focusable(next) ? next : heading;
        if (focusable(target)) target.focus();
        else recover();
        pending.current = { data: latest.current };
        announce("Answer saved");
      },
    }),
    [announce, recover],
  );

  return { ref, scope };
}

export const AnswerScopeProvider = ScopeContext.Provider;

/** The enclosing scope's after-send handler; outside a scope only the box closes. */
export function useAnswerScope(): Scope {
  return React.useContext(ScopeContext) ?? NO_SCOPE;
}

const NO_SCOPE: Scope = { sent: () => {} };
