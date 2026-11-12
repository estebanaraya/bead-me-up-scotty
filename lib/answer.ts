import type { Comment } from "./schema";
import { ms } from "./overview-progress";

/** The longest answer the route accepts, in characters after trimming; the box shows the overage. */
export const ANSWER_MAX = 4000;

/** The newest non-empty comment on an issue by time, from anyone. */
function newestComment(comments: Comment[] | undefined): Comment | null {
  return (comments ?? [])
    .filter((c) => (c.text ?? "").trim() !== "")
    .reduce<Comment | null>(
      (best, c) => (best === null || (ms(c.created_at) ?? 0) >= (ms(best.created_at) ?? 0) ? c : best),
      null,
    );
}

/** Esteban's newest answer on an issue: his latest non-empty comment by time, else none. */
export function latestAnswer(comments: Comment[] | undefined, humanActor: string | undefined): Comment | null {
  if (!humanActor) return null;
  return newestComment((comments ?? []).filter((c) => c.author === humanActor));
}

/**
 * True when the newest comment on the issue is Esteban's answer with this text, so
 * a resend (after a failed label write, or a double send) adds the label without a
 * duplicate comment. A newer comment from anyone (a lead re-asking) means the same
 * text is a new answer and is posted again.
 */
export function answerAlreadySaved(comments: Comment[] | undefined, humanActor: string, text: string): boolean {
  const newest = newestComment(comments);
  return newest !== null && newest.author === humanActor && newest.text.trim() === text.trim();
}

const LABEL_FAILED = "Your answer was saved; marking it answered failed. Send again to finish.";

/**
 * The error to report when the comment saved but the `answered` label write failed.
 * Keeps the original error (and so a BdError's code and HTTP status) and prefixes
 * the message, so the client knows a resend only finishes the label.
 */
export function labelFailure(e: unknown): Error {
  const detail = e instanceof Error ? e.message : String(e);
  if (e instanceof Error) {
    try {
      e.message = `${LABEL_FAILED} (${detail})`;
      return e;
    } catch {
      // A read-only message: fall back to a plain error that still carries the note.
    }
  }
  return new Error(`${LABEL_FAILED} (${detail})`);
}
