import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bead } from "./schema";
import { makeIndex } from "./beads-view";
import {
  bulkMinutes,
  buildPhases,
  doneThisWeek,
  inBulk,
  lastClosed,
  lastMovedAt,
  paceOf,
} from "./overview-progress";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const HOUR = 3600_000;
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

function bead(over: Partial<Bead> & { id: string }): Bead {
  return {
    title: over.id,
    status: "open",
    priority: 2,
    issue_type: "task",
    labels: [],
    dependencies: [],
    ...over,
  } as Bead;
}
const child = (id: string, parent: string, over: Partial<Bead> = {}) =>
  bead({ id, dependencies: [{ issue_id: id, depends_on_id: parent, type: "parent-child" }], ...over } as Partial<Bead> & { id: string });

test("bulk minutes need 10 closes in one minute", () => {
  const ten = Array.from({ length: 10 }, (_, i) =>
    bead({ id: `b${i}`, status: "closed", closed_at: "2026-11-11T19:29:1" + (i % 10) + "Z" }),
  );
  const nine = Array.from({ length: 9 }, (_, i) =>
    bead({ id: `c${i}`, status: "closed", closed_at: "2026-11-11T20:00:0" + i + "Z" }),
  );
  const bulk = bulkMinutes([...ten, ...nine]);
  assert.deepEqual([...bulk], ["2026-11-11T19:29"]);
  assert.equal(inBulk("2026-11-11T19:29:45Z", bulk), true);
  assert.equal(inBulk("2026-11-11T20:00:05Z", bulk), false);
  assert.equal(inBulk(null, bulk), false);
});

test("phases count non-epic work at any depth, decisions included", () => {
  const phase = bead({ id: "p", issue_type: "epic", labels: ["phase"], updated_at: iso(50 * HOUR) });
  const sub = child("s", "p", { issue_type: "epic" });
  const beads = [
    phase,
    sub,
    child("t1", "p", { status: "closed", updated_at: iso(2 * HOUR) }),
    child("t2", "s", { status: "in_progress" }),
    child("t3", "s"),
    child("d1", "p", { issue_type: "decision" }),
    bead({ id: "loose" }),
  ];
  const [p] = buildPhases(beads, makeIndex(beads), new Set());
  assert.deepEqual(
    { id: p.id, done: p.done, total: p.total, inProgress: p.inProgress, lastTouched: p.lastTouched },
    { id: "p", done: 1, total: 4, inProgress: 1, lastTouched: iso(2 * HOUR) },
  );
});

test("work under a nested phase counts toward the nearest phase only", () => {
  const outer = bead({ id: "o", issue_type: "epic", labels: ["phase"] });
  const inner = child("i", "o", { issue_type: "epic", labels: ["phase"] });
  const beads = [outer, inner, child("w", "i"), child("x", "o")];
  const phases = buildPhases(beads, makeIndex(beads), new Set());
  const byId = Object.fromEntries(phases.map((p) => [p.id, p.total]));
  assert.deepEqual(byId, { o: 1, i: 1 });
});

test("closed phases are not listed and parent cycles terminate", () => {
  const a = child("a", "b", { issue_type: "epic", labels: ["phase"] });
  const b = child("b", "a", { issue_type: "epic", labels: ["phase"], status: "closed" });
  const beads = [a, b, child("t", "a")];
  const phases = buildPhases(beads, makeIndex(beads), new Set());
  assert.deepEqual(phases.map((p) => [p.id, p.total]), [["a", 1]]);
});

test("current phases sort in-progress first, then most recently touched", () => {
  const beads = [
    bead({ id: "quiet", issue_type: "epic", labels: ["phase"], updated_at: iso(1 * HOUR) }),
    bead({ id: "busy", issue_type: "epic", labels: ["phase"], updated_at: iso(90 * HOUR) }),
    child("w", "busy", { status: "in_progress", updated_at: iso(80 * HOUR) }),
    bead({ id: "old", issue_type: "epic", labels: ["phase"], updated_at: iso(40 * HOUR) }),
  ];
  const ids = buildPhases(beads, makeIndex(beads), new Set()).map((p) => p.id);
  assert.deepEqual(ids, ["busy", "quiet", "old"]);
});

test("pace thresholds", () => {
  assert.equal(paceOf(iso(23 * HOUR), NOW), "moving");
  assert.equal(paceOf(iso(24 * HOUR), NOW), "slow");
  assert.equal(paceOf(iso(72 * HOUR), NOW), "slow");
  assert.equal(paceOf(iso(73 * HOUR), NOW), "idle");
  assert.equal(paceOf(null, NOW), "unknown");
});

test("last moved ignores bulk updates and counts status.at", () => {
  const bulk = new Set(["2026-11-12T11:00"]);
  const beads = [bead({ id: "a", updated_at: "2026-11-12T11:00:30Z" }), bead({ id: "b", updated_at: iso(30 * HOUR) })];
  assert.equal(lastMovedAt(beads, bulk, null), iso(30 * HOUR));
  assert.equal(lastMovedAt(beads, bulk, iso(2 * HOUR)), iso(2 * HOUR));
  assert.equal(lastMovedAt([], bulk, null), null);
});

test("done this week excludes bulk, epics and old closes", () => {
  const bulk = new Set(["2026-11-11T19:29"]);
  const beads = [
    bead({ id: "a", status: "closed", closed_at: iso(2 * HOUR) }),
    bead({ id: "b", status: "closed", closed_at: "2026-11-11T19:29:10Z" }),
    bead({ id: "c", status: "closed", closed_at: iso(8 * 24 * HOUR) }),
    bead({ id: "d", status: "closed", issue_type: "epic", closed_at: iso(3 * HOUR) }),
    bead({ id: "e", status: "open" }),
  ];
  assert.equal(doneThisWeek(beads, bulk, NOW), 1);
});

test("last closed is the newest non-bulk close", () => {
  const bulk = new Set(["2026-11-12T11:00"]);
  const beads = [
    bead({ id: "a", title: "Old", status: "closed", closed_at: iso(30 * HOUR) }),
    bead({ id: "b", title: "Bulk", status: "closed", closed_at: "2026-11-12T11:00:05Z" }),
    bead({ id: "c", title: "New", status: "closed", closed_at: iso(5 * HOUR) }),
  ];
  assert.deepEqual(lastClosed(beads, bulk), { id: "c", title: "New", closedAt: iso(5 * HOUR) });
  assert.equal(lastClosed([], bulk), null);
});
