import { test } from "node:test";
import assert from "node:assert/strict";
import type { Comment } from "./schema";
import { answerAlreadySaved, answerFailureNote, labelFailure, latestAnswer } from "./answer";

const ME = "estebanaraya";
const c = (author: string, text: string, created_at: string): Comment => ({ author, text, created_at });

test("latest answer: Esteban's newest non-empty comment by time, not array order", () => {
  const comments = [
    c(ME, "second", "2026-11-12T10:00:00Z"),
    c(ME, "first", "2026-11-12T09:00:00Z"),
    c("agent", "later agent note", "2026-11-12T11:00:00Z"),
    c(ME, "   ", "2026-11-12T12:00:00Z"),
  ];
  assert.equal(latestAnswer(comments, ME)?.text, "second");
});

test("latest answer: none without an actor or without his comments", () => {
  assert.equal(latestAnswer([c("agent", "hi", "2026-11-12T10:00:00Z")], ME), null);
  assert.equal(latestAnswer([c(ME, "hi", "2026-11-12T10:00:00Z")], undefined), null);
  assert.equal(latestAnswer(undefined, ME), null);
});

test("resend: skips the comment when his newest answer has the same text", () => {
  const comments = [c(ME, "  Ship it  ", "2026-11-12T10:00:00Z")];
  assert.equal(answerAlreadySaved(comments, ME, "Ship it"), true);
});

test("resend: posts when the text differs, his older answer matches, or another author wrote it", () => {
  const older = [c(ME, "Ship it", "2026-11-12T09:00:00Z"), c(ME, "Hold", "2026-11-12T10:00:00Z")];
  assert.equal(answerAlreadySaved(older, ME, "Ship it"), false);
  assert.equal(answerAlreadySaved([c(ME, "Hold", "2026-11-12T10:00:00Z")], ME, "Ship it"), false);
  assert.equal(answerAlreadySaved([c("agent", "Ship it", "2026-11-12T10:00:00Z")], ME, "Ship it"), false);
  assert.equal(answerAlreadySaved([], ME, "Ship it"), false);
});

test("resend: skips when his identical answer is the newest comment overall", () => {
  const comments = [
    c("lead", "Which option, A or B?", "2026-11-12T09:00:00Z"),
    c(ME, "A", "2026-11-12T10:00:00Z"),
  ];
  assert.equal(answerAlreadySaved(comments, ME, "A"), true);
});

test("resend: posts when a newer comment from anyone follows his identical answer (re-ask)", () => {
  const comments = [
    c(ME, "A", "2026-11-12T10:00:00Z"),
    c("lead", "Re-asking: still A after the change?", "2026-11-12T11:00:00Z"),
  ];
  assert.equal(answerAlreadySaved(comments, ME, "A"), false);
});

test("label failure: keeps the original error and its code, prefixes the saved note", () => {
  class CodedError extends Error {
    code = "schema_migration_required";
  }
  const original = new CodedError("bd says migrate");
  const out = labelFailure(original);
  assert.equal(out, original);
  assert.equal((out as CodedError).code, "schema_migration_required");
  assert.equal(out.message, "Your answer was saved; marking it answered failed. Send again to finish. (bd says migrate)");
});

test("label failure: wraps a non-Error throw", () => {
  const out = labelFailure("boom");
  assert.ok(out instanceof Error);
  assert.equal(out.message, "Your answer was saved; marking it answered failed. Send again to finish. (boom)");
});

test("failure note: a label failure is reported as the server wrote it, with no retry line", () => {
  const message = labelFailure(new Error("bd label failed")).message;
  assert.equal(answerFailureNote({ message }), message);
});

test("failure note: a label failure carried in detail (schema upgrade) is still told apart", () => {
  const detail = labelFailure(new Error("bd says migrate")).message;
  const note = answerFailureNote({ message: "This project's beads database needs a one-time upgrade.", detail });
  assert.equal(note, detail);
});

test("failure note: any other failure keeps the server's words and says the text is kept", () => {
  assert.equal(
    answerFailureNote({ message: "No issue cc-1 in this project." }),
    "No issue cc-1 in this project. Your text is kept; open it again to retry.",
  );
  assert.equal(
    answerFailureNote({ message: "Failed to fetch" }),
    "Failed to fetch. Your text is kept; open it again to retry.",
  );
});
