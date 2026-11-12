import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bead } from "./schema";
import { awaitingHuman, awaitingHumanGate, isAnswered, makeIndex, needsHuman, readyHumanGate } from "./beads-view";
import { escalationsSince } from "./escalations";

function bead(over: Partial<Bead> & { id: string }): Bead {
  return { title: over.id, status: "open", priority: 2, issue_type: "task", labels: [], dependencies: [], ...over } as Bead;
}
const gate = (id: string, labels: string[] = []) => bead({ id, issue_type: "gate", await_type: "human", labels });

test("isAnswered reads the answered label", () => {
  assert.equal(isAnswered(bead({ id: "a", labels: ["human", "answered"] })), true);
  assert.equal(isAnswered(bead({ id: "b", labels: ["human"] })), false);
  assert.equal(isAnswered(bead({ id: "c", labels: undefined })), false);
});

test("an answered human-labelled bead no longer awaits the human; needsHuman still sees it", () => {
  const answered = bead({ id: "a", labels: ["human", "answered"] });
  assert.equal(awaitingHuman(answered), false);
  assert.equal(needsHuman(answered), true);
});

test("an unanswered human-labelled bead still awaits the human", () => {
  assert.equal(awaitingHuman(bead({ id: "a", labels: ["human"] })), true);
  assert.equal(awaitingHuman(bead({ id: "b", labels: ["human"], status: "closed" })), false);
  assert.equal(awaitingHuman(bead({ id: "c" })), false);
});

test("an answered human gate drops out; an unanswered ready gate stays", () => {
  const answered = gate("g1", ["answered"]);
  const open = gate("g2");
  const index = makeIndex([answered, open]);
  assert.equal(awaitingHumanGate(answered, index), false);
  assert.equal(readyHumanGate(answered, index), true);
  assert.equal(awaitingHumanGate(open, index), true);
});

test("a re-ask (answered label removed) counts again", () => {
  const reasked = bead({ id: "a", labels: ["human"] });
  const reaskedGate = gate("g");
  assert.equal(awaitingHuman(reasked), true);
  assert.equal(awaitingHumanGate(reaskedGate, makeIndex([reaskedGate])), true);
});

test("escalations: first tick is a silent baseline", () => {
  const r = escalationsSince(null, [bead({ id: "a", labels: ["human"] })]);
  assert.deepEqual([...r.seen], ["a"]);
  assert.deepEqual(r.raised, []);
});

test("escalations: answering an ask raises nothing and drops it from the seen set", () => {
  const r = escalationsSince(new Set(["a"]), [bead({ id: "a", labels: ["human", "answered"] })]);
  assert.deepEqual(r.raised, []);
  assert.deepEqual([...r.seen], []);
});

test("escalations: a re-ask after an answer is raised again, like a new ask", () => {
  const afterAnswer = escalationsSince(new Set(["a"]), [bead({ id: "a", labels: ["human", "answered"] })]);
  const reasked = bead({ id: "a", labels: ["human"] });
  const r = escalationsSince(afterAnswer.seen, [reasked]);
  assert.deepEqual(r.raised.map((b) => b.id), ["a"]);
  assert.deepEqual([...r.seen], ["a"]);
});

test("escalations: an ask still waiting is not raised twice", () => {
  const r = escalationsSince(new Set(["a"]), [bead({ id: "a", labels: ["human"] }), bead({ id: "b", labels: ["human"] })]);
  assert.deepEqual(r.raised.map((b) => b.id), ["b"]);
});
