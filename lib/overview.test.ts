import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bead } from "./schema";
import { buildHome, buildTile, compareTiles, emptyTile, hasRecordedWork, isAsk, leadRef, readStatus, type Tile } from "./overview";

const NOW = new Date("2026-11-12T12:00:00Z");
const HOUR = 3600_000;
const iso = (offsetMs: number) => new Date(NOW.getTime() - offsetMs).toISOString();
const P = { id: "jq", name: "Jaque" };
const UUID = "local_b73df13a-9bc6-4676-abf6-d8a625657522";

function bead(over: Partial<Bead> & { id: string }): Bead {
  return { title: over.id, status: "open", priority: 2, issue_type: "task", labels: [], dependencies: [], ...over } as Bead;
}
const blocks = (id: string, on: string) => [{ issue_id: id, depends_on_id: on, type: "blocks" }];

test("asks: human label, any open gate, open non-kb decisions", () => {
  assert.equal(isAsk(bead({ id: "a", labels: ["human"] })), true);
  assert.equal(isAsk(bead({ id: "b", issue_type: "decision" })), true);
  assert.equal(isAsk(bead({ id: "c", issue_type: "decision", labels: ["kb"] })), false);
  assert.equal(isAsk(bead({ id: "d", issue_type: "decision", status: "closed" })), false);
  assert.equal(isAsk(bead({ id: "e", issue_type: "decision", status: "deferred" })), false);
  assert.equal(isAsk(bead({ id: "f" })), false);
  assert.equal(isAsk(bead({ id: "g", issue_type: "gate", await_type: "human" })), true);
  assert.equal(isAsk(bead({ id: "h", issue_type: "gate", await_type: "human", status: "closed" })), false);
  assert.equal(isAsk(bead({ id: "i", issue_type: "gate", await_type: "timer" })), false);
});

test("asks split into open and waiting, oldest first", () => {
  const beads = [
    bead({ id: "x" }),
    bead({ id: "new", issue_type: "decision", created_at: iso(1 * HOUR) }),
    bead({ id: "old", issue_type: "decision", created_at: iso(9 * HOUR) }),
    bead({ id: "held", issue_type: "decision", dependencies: blocks("held", "x") } as Partial<Bead> & { id: string }),
    bead({ id: "gate", issue_type: "gate", await_type: "human", dependencies: blocks("gate", "x") } as Partial<Bead> & { id: string }),
  ];
  const tile = buildTile(P, beads, {}, NOW);
  assert.deepEqual(tile.asksOpen.map((a) => a.id), ["old", "new"]);
  assert.deepEqual(tile.asksWaiting.map((a) => [a.id, a.kind]), [["held", "decision"], ["gate", "gate"]]);
  assert.equal(tile.asksOpen[0].projectName, "Jaque");
});

test("top ask prefers the lead's pick, then the oldest P0-1 open ask", () => {
  const beads = [
    bead({ id: "p1", issue_type: "decision", priority: 1, created_at: iso(5 * HOUR) }),
    bead({ id: "p0", issue_type: "decision", priority: 0, created_at: iso(9 * HOUR) }),
    bead({ id: "low", issue_type: "decision", priority: 3, created_at: iso(20 * HOUR) }),
    bead({ id: "done", issue_type: "decision", status: "closed" }),
  ];
  const lead = buildTile(P, beads, { "status.ask_id": "low", "status.ask": "  Pick the platforms  " }, NOW);
  assert.deepEqual([lead.topAsk?.id, lead.topAsk?.text, lead.topAsk?.source], ["low", "Pick the platforms", "lead"]);
  const titleOnly = buildTile(P, beads, { "status.ask_id": "low" }, NOW);
  assert.equal(titleOnly.topAsk?.text, "low");
  const closedPick = buildTile(P, beads, { "status.ask_id": "done" }, NOW);
  assert.deepEqual([closedPick.topAsk?.id, closedPick.topAsk?.source], ["p0", "priority"]);
  const none = buildTile(P, [bead({ id: "q", issue_type: "decision", priority: 2 })], {}, NOW);
  assert.equal(none.topAsk, null);
});

test("status is trimmed, capped, validated and marked stale", () => {
  // A lead's sentence is never cut: 500 characters is only a guard against runaway text.
  const sentence = "x".repeat(480);
  const s = readStatus({ "status.moved": sentence, "status.next": "  Next  ", "status.at": iso(48 * HOUR) }, iso(1 * HOUR));
  assert.equal(s.moved, sentence);
  const runaway = readStatus({ "status.moved": "y".repeat(900) }, null).moved;
  assert.equal(runaway?.length, 503);
  assert.ok(runaway?.endsWith("..."));
  assert.equal(s.next, "Next");
  assert.equal(s.at, iso(48 * HOUR));
  assert.equal(s.stale, true);
  assert.equal(readStatus({ "status.at": iso(10 * HOUR) }, iso(1 * HOUR)).stale, false);
  assert.equal(readStatus({ "status.at": "yesterday" }, iso(1 * HOUR)).at, null);
  assert.deepEqual(readStatus({}, null), { moved: null, next: null, at: null, stale: false });
});

test("lead links only from local_<uuid> ids", () => {
  assert.deepEqual(leadRef({ lead: UUID, lead_title: "Jaque" }), { id: UUID, title: "Jaque", link: `claude://claude.ai/epitaxy/${UUID}` });
  assert.equal(leadRef({ lead: "javascript:alert(1)" }), null);
  assert.equal(leadRef({ lead: 42 }), null);
  assert.equal(leadRef(undefined), null);
});

test("tile lead is the most recently updated in-flight issue's", () => {
  const other = "local_00000000-0000-0000-0000-000000000000";
  const beads = [
    bead({ id: "a", status: "in_progress", updated_at: iso(5 * HOUR), metadata: { lead: other } }),
    bead({ id: "b", status: "in_progress", updated_at: iso(1 * HOUR), metadata: { lead: UUID, lead_title: "Jaque" } }),
  ];
  assert.equal(buildTile(P, beads, {}, NOW).lead?.id, UUID);
});

test("tile carries pace, done this week and status fallback", () => {
  const beads = [
    bead({ id: "a", status: "closed", closed_at: iso(2 * HOUR), updated_at: iso(2 * HOUR), title: "Guard step 4" }),
  ];
  const t = buildTile(P, beads, {}, NOW);
  assert.deepEqual([t.state, t.pace, t.doneThisWeek, t.lastClosed?.title], ["ok", "moving", 1, "Guard step 4"]);
  assert.deepEqual(t.status, { moved: null, next: null, at: null, stale: false });
});

test("tiles keep a stable order and the strip is oldest first", () => {
  const tile = (name: string, pace: Tile["pace"], askAge?: number): Tile => ({
    ...emptyTile({ id: name.toLowerCase(), name }, "not-on-beads"),
    state: "ok",
    pace,
    topAsk: askAge === undefined ? null : { projectId: name, projectName: name, id: name, title: name, kind: "decision", createdAt: iso(askAge), text: name, source: "priority" },
  });
  const tiles = [tile("Zoneboid", "idle", 1 * HOUR), tile("studio", "slow"), tile("Jaque", "moving", 9 * HOUR), tile("Mint", "unknown")];
  assert.deepEqual([...tiles].sort(compareTiles).map((t) => t.name), ["Jaque", "studio", "Mint", "Zoneboid"]);
  const home = buildHome(tiles, NOW);
  assert.deepEqual(home.needsNow.map((a) => a.id), ["Jaque", "Zoneboid"]);
  assert.equal(home.generatedAt, NOW.toISOString());
});

test("an unknown pace still knows whether the project has recorded work", () => {
  // The 2026-11-11 import: every close in one minute, so no movement, but a phase meter with real numbers.
  const imported = [
    bead({ id: "ph", issue_type: "epic", labels: ["phase"], updated_at: "2026-11-11T19:29:10Z" }),
    ...Array.from({ length: 10 }, (_, i) =>
      bead({ id: `t${i}`, status: "closed", dependencies: [{ issue_id: `t${i}`, depends_on_id: "ph", type: "parent-child" }], closed_at: "2026-11-11T19:29:30Z", updated_at: "2026-11-11T19:29:30Z" } as Partial<Bead> & { id: string }),
    ),
  ];
  const t = buildTile(P, imported, {}, NOW);
  assert.equal(t.pace, "unknown");
  assert.equal(hasRecordedWork(t), true);
  const asked = buildTile(P, [bead({ id: "d", issue_type: "decision" })], {}, NOW);
  assert.deepEqual([asked.pace, hasRecordedWork(asked)], ["unknown", true]);
  assert.equal(hasRecordedWork(buildTile(P, [], {}, NOW)), false);
});
