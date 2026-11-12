import type { Comment } from "./schema";
import { ms } from "./overview-progress";

/** Esteban's newest answer on an issue: his latest non-empty comment by time, else none. */
export function latestAnswer(comments: Comment[] | undefined, humanActor: string | undefined): Comment | null {
  if (!humanActor) return null;
  const mine = (comments ?? []).filter((c) => c.author === humanActor && (c.text ?? "").trim() !== "");
  return mine.reduce<Comment | null>(
    (best, c) => (best === null || (ms(c.created_at) ?? 0) >= (ms(best.created_at) ?? 0) ? c : best),
    null,
  );
}

/**
 * True when Esteban's newest answer already has this text, so a resend (after a
 * failed label write, or a double send) adds the label without a duplicate comment.
 */
export function answerAlreadySaved(comments: Comment[] | undefined, humanActor: string, text: string): boolean {
  const latest = latestAnswer(comments, humanActor);
  return latest !== null && latest.text.trim() === text.trim();
}
