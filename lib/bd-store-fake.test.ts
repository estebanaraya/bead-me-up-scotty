import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The store runs against a fake bd: BD_BIN is node itself and the repo directory
// holds extensionless scripts named after bd commands, so `node create ...` runs
// ./create from the repo cwd. Each script logs its argv, and nothing touches a
// real bd or real data. lib/bd.ts imports "server-only", so the store runs in a
// child node with the react-server condition (as in bd-store-ids.test.ts).
const root = path.resolve(import.meta.dirname, "..");

// An id bd might hand back that the caller-id rule rejects (leading underscore).
const ODD_ID = "_odd.1";

// argv[1] is the script path, so its basename is the bd command word.
const log = `require("node:fs").appendFileSync("calls.jsonl",
  JSON.stringify([require("node:path").basename(process.argv[1]), ...process.argv.slice(2)]) + "\\n");`;
const fakes: Record<string, string> = {
  create: `${log} process.stdout.write(JSON.stringify({ data: { id: ${JSON.stringify(ODD_ID)} } }));`,
  gate: `${log} process.stdout.write(JSON.stringify({ data: { id: ${JSON.stringify(ODD_ID)} } }));`,
  update: log,
  show: `${log} const id = process.argv[2];
    process.stdout.write(JSON.stringify({ data: [{ id, title: "t", status: "open", issue_type: "task", priority: 2 }] }));`,
};

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scotty-fake-bd-"));
  for (const [name, body] of Object.entries(fakes)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

function runStore(repo: string, body: string): unknown {
  const script = `
import { createBdStore } from "./lib/bd.ts";
const store = createBdStore(${JSON.stringify(repo)});
let result;
try {
  result = { ok: await (async () => { ${body} })() };
} catch (e) {
  result = { code: e.code ?? "uncoded", message: e.message };
}
process.stdout.write(JSON.stringify(result));
`;
  const stdout = execFileSync(
    process.execPath,
    ["--conditions=react-server", "--no-warnings", "--import", "./scripts/ts-resolve.mjs", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8", env: { ...process.env, BD_BIN: process.execPath } },
  );
  return JSON.parse(stdout);
}

function calls(repo: string): string[][] {
  return fs
    .readFileSync(path.join(repo, "calls.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as string[]);
}

test("bd store: a create whose returned id fails the caller-id rule still returns the created bead", () => {
  const repo = makeRepo();
  try {
    const out = runStore(repo, `return store.create({ title: "t", issue_type: "task", priority: 2 }, "a");`) as {
      ok?: { id: string };
    };
    assert.deepEqual(out.ok?.id, ODD_ID, JSON.stringify(out));
    assert.deepEqual(calls(repo).at(-1)?.slice(0, 2), ["show", ODD_ID]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("bd store: a gate whose returned id fails the caller-id rule still returns the created gate", () => {
  const repo = makeRepo();
  try {
    const out = runStore(repo, `return store.createGate("cc-1", "why", "a");`) as { ok?: { id: string } };
    assert.deepEqual(out.ok?.id, ODD_ID, JSON.stringify(out));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("bd store: update with parent \"\" (detach) passes validation and reaches bd as an empty --parent", () => {
  const repo = makeRepo();
  try {
    const out = runStore(repo, `return store.update("cc-1", { parent: "" }, "a");`) as { ok?: { id: string } };
    assert.equal(out.ok?.id, "cc-1", JSON.stringify(out));
    const update = calls(repo).find((c) => c[0] === "update");
    assert.deepEqual(update, ["update", "cc-1", "--parent", ""]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
