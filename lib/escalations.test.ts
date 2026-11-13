import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bead } from "./schema";
import { projectEscalationsSince } from "./escalations";

function ask(id: string): Bead {
  const over: Partial<Bead> & { id: string } = { id, labels: ["human"] };
  return { title: id, status: "open", priority: 2, issue_type: "task", dependencies: [], ...over } as Bead;
}

test("escalations: a project switch is a silent baseline, not a burst of every waiting ask", () => {
  const first = projectEscalationsSince(null, "alpha", [ask("a-1")]);
  const switched = projectEscalationsSince(first.state, "beta", [ask("b-1"), ask("b-2")]);
  assert.deepEqual(switched.raised, []);
  assert.equal(switched.state.projectId, "beta");
  assert.deepEqual([...switched.state.seen].sort(), ["b-1", "b-2"]);
});

test("escalations: after a project switch, a new ask in that project is raised", () => {
  const first = projectEscalationsSince(null, "alpha", [ask("a-1")]);
  const switched = projectEscalationsSince(first.state, "beta", [ask("b-1")]);
  const next = projectEscalationsSince(switched.state, "beta", [ask("b-1"), ask("b-2")]);
  assert.deepEqual(next.raised.map((b) => b.id), ["b-2"]);
});

test("escalations: within one project, a new ask is raised against the previous tick", () => {
  const first = projectEscalationsSince(null, "alpha", [ask("a-1")]);
  const next = projectEscalationsSince(first.state, "alpha", [ask("a-1"), ask("a-2")]);
  assert.deepEqual(next.raised.map((b) => b.id), ["a-2"]);
});

test("escalations: switching back to a project does not re-raise its waiting asks", () => {
  const first = projectEscalationsSince(null, "alpha", [ask("a-1")]);
  const beta = projectEscalationsSince(first.state, "beta", [ask("b-1")]);
  const back = projectEscalationsSince(beta.state, "alpha", [ask("a-1")]);
  assert.deepEqual(back.raised, []);
});
