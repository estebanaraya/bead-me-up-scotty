import { test } from "node:test";
import assert from "node:assert/strict";
import type { Comment } from "./schema";
import { answerAlreadySaved, latestAnswer } from "./answer";

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
