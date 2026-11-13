import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// isBdAvailable runs `bd --version` with a 5 s limit. lib/bd.ts imports
// "server-only", so it runs in a child node with the react-server condition (as in
// bd-store-fake.test.ts). With `ignoreSigterm`, the child makes the timeout SIGTERM
// a no-op, standing in for a bd that ignores SIGTERM; other signals pass through.
const root = path.resolve(import.meta.dirname, "..");

function available(repo: string, bin: string, ignoreSigterm = false): { ok: boolean; ms: number } {
  const script = `
import { ChildProcess } from "node:child_process";
import os from "node:os";
import { isBdAvailable } from "./lib/bd.ts";
if (${ignoreSigterm}) {
  const original = ChildProcess.prototype.kill;
  ChildProcess.prototype.kill = function (signal) {
    const term = signal === "SIGTERM" || signal === os.constants.signals.SIGTERM;
    return term ? false : original.call(this, signal);
  };
}
const started = Date.now();
const ok = await isBdAvailable(${JSON.stringify(repo)});
process.stdout.write(JSON.stringify({ ok, ms: Date.now() - started }));
process.exit(0);
`;
  const stdout = execFileSync(
    process.execPath,
    ["--conditions=react-server", "--no-warnings", "--import", "./scripts/ts-resolve.mjs", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8", timeout: 15_000, env: { ...process.env, BD_BIN: bin } },
  );
  return JSON.parse(stdout);
}

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scotty-bd-available-"));
  fs.mkdirSync(path.join(dir, ".beads"));
  return dir;
}

test("bd available: a bd that answers --version in a repo with .beads is available", () => {
  const repo = makeRepo();
  try {
    assert.equal(available(repo, process.execPath).ok, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("bd available: a bd that cannot be spawned is not available", () => {
  const repo = makeRepo();
  try {
    assert.equal(available(repo, path.join(repo, "no-such-bd")).ok, false);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// cmd.exe treats --version as no command and waits on its piped stdin, so it
// hangs like a stuck bd. Windows only: it is the hanging binary to hand here.
test(
  "bd available: a bd that hangs past an ignored SIGTERM is not available, at the backstop",
  { skip: process.platform !== "win32" },
  () => {
    const repo = makeRepo();
    try {
      const { ok, ms } = available(repo, process.env.ComSpec || "cmd.exe", true);
      assert.equal(ok, false);
      assert.ok(ms >= 7000 - 50 && ms < 10_000, `false at the 5 s limit plus the 2 s backstop (${ms} ms)`);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  },
);
