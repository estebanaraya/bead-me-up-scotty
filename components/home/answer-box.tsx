"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { clearDraft, draftKey, readDraft, writeDraft } from "@/lib/answer-drafts";
import { catColor } from "@/lib/beads-view";
import { FOCUS_RING } from "@/components/home/tile-parts";

const HINT = "Saved as a comment for the lead; the question stays open until the lead acts.";

/**
 * Inline answer form. The whole box is disabled while a send is in flight, so one answer
 * writes one comment. The text is a draft kept per issue outside the box: it survives a
 * failed send, Escape, the line leaving its list and a reload. Only a successful send or
 * Cancel discards it. Success refreshes the home, then `onSent` runs.
 */
export function AnswerBox({
  projectId,
  issueId,
  ask,
  onClose,
  onSent,
}: {
  projectId: string;
  issueId: string;
  /** The ask being answered, for the textarea's accessible name. */
  ask: string;
  /** Closes the box. Escape keeps the draft; Cancel discards it first. */
  onClose: () => void;
  onSent: () => void;
}) {
  const qc = useQueryClient();
  const key = draftKey(projectId, issueId);
  const [text, setText] = React.useState(() => readDraft(key));
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const answer = text.trim();

  // A reopened draft puts the caret at its end, ready to continue.
  React.useEffect(() => {
    const el = textarea.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Disabling the box during the send dropped focus to the page; a failure hands it back.
  React.useEffect(() => {
    if (error) textarea.current?.focus();
  }, [error]);

  async function send() {
    if (!answer || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.answer(projectId, issueId, answer);
      clearDraft(key);
      await qc.invalidateQueries({ queryKey: ["overview"] });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }

  return (
    <form
      aria-busy={sending}
      className="mt-[6px] flex flex-col gap-[8px]"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !sending) {
          e.preventDefault();
          onClose();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void send();
        }
      }}
    >
      <fieldset disabled={sending} className="contents">
        <label htmlFor={`${id}-text`} className="sr-only">
          Your answer: {ask}
        </label>
        <textarea
          ref={textarea}
          id={`${id}-text`}
          autoFocus
          rows={3}
          value={text}
          aria-describedby={`${id}-note`}
          onChange={(e) => {
            setText(e.target.value);
            writeDraft(key, e.target.value);
          }}
          className={`block w-full resize-y rounded-[10px] border border-[var(--brand)] bg-[var(--bg)] px-[12px] py-[10px] text-[13px] leading-[1.45] text-[var(--text)] caret-[var(--brand)] disabled:opacity-60 ${FOCUS_RING}`}
        />
        <div className="flex flex-wrap items-center justify-end gap-x-[8px] gap-y-[6px]">
          <p
            id={`${id}-note`}
            role={error ? "alert" : undefined}
            className="w-full text-[11.5px] leading-[1.4] text-[var(--text-2)] [overflow-wrap:anywhere] sm:mr-auto sm:w-auto sm:flex-1"
          >
            {error ? (
              <span className="flex items-start gap-[6px] text-[var(--text)]">
                <span
                  aria-hidden
                  className="mt-[5px] size-[6px] flex-shrink-0 rounded-full"
                  style={{ background: catColor("blocked") }}
                />
                <span>{error}</span>
              </span>
            ) : (
              HINT
            )}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              clearDraft(key);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={sending || !answer}>
            {sending ? "Sending…" : "Send answer"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
