import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

// lib/bd.ts imports "server-only", which throws outside the react-server condition,
// so the store runs in a child node with that condition. BD_BIN points at a binary
// that does not exist: a call that skipped validation fails with a spawn error, not
// invalid_id, and no real bd is ever run.
const root = path.resolve(import.meta.dirname, "..");

const script = `
import { createBdStore } from "./lib/bd.ts";
const store = createBdStore(${JSON.stringify(os.tmpdir())});
const bad = "--foo=bar";
const calls = {
  get: () => store.get(bad),
  update: () => store.update(bad, { title: "t" }, "a"),
  updateParent: () => store.update("cc-1", { parent: bad }, "a"),
  setStatus: () => store.setStatus(bad, "closed", "a"),
  remove: () => store.remove(bad, "a"),
  addComment: () => store.addComment(bad, "hi", "a"),
  addDep: () => store.addDep(bad, "cc-2", "blocks", "a"),
  addDepTarget: () => store.addDep("cc-1", bad, "blocks", "a"),
  removeDep: () => store.removeDep(bad, "cc-2", "a"),
  removeDepTarget: () => store.removeDep("cc-1", bad, "a"),
  createGate: () => store.createGate(bad, "why", "a"),
  removeLabel: () => store.removeLabel(bad, "x", "a"),
  addLabel: () => store.addLabel(bad, "x", "a"),
  archive: () => store.archive(bad, "a"),
  createParent: () => store.create({ title: "t", issue_type: "task", priority: 2, parent: bad }, "a"),
};
const out = {};
for (const [name, call] of Object.entries(calls)) {
  try {
    await call();
    out[name] = "resolved";
  } catch (e) {
    out[name] = e.code ?? "uncoded";
  }
}
process.stdout.write(JSON.stringify(out));
`;

test("bd store: every method that puts an issue id in a bd argument list rejects a flag-shaped id with invalid_id", () => {
  const stdout = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--no-warnings",
      "--import",
      "./scripts/ts-resolve.mjs",
      "--input-type=module",
      "-e",
      script,
    ],
    { cwd: root, encoding: "utf8", env: { ...process.env, BD_BIN: path.join(os.tmpdir(), "no-such-bd-binary") } },
  );
  const results = JSON.parse(stdout) as Record<string, string>;
  for (const [name, code] of Object.entries(results)) {
    assert.equal(code, "invalid_id", name);
  }
  assert.equal(Object.keys(results).length, 15);
});
