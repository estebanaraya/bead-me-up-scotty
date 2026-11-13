import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BD_READ_TIMEOUT_MS,
  BD_WRITE_TIMEOUT_MS,
  BdError,
  bdTimeoutFor,
  runBdRaw,
  serializeWrite,
  withBackstop,
  asBdTimeout,
  bdVersion,
  pExecFile,
} from "./bd-exec";

// A fake bd: the node binary itself, told to hang or to print and exit.
const fakeBd = process.execPath;
const HANG = ["-e", "setTimeout(() => {}, 10000)"];
const PRINT_OK = ["-e", "process.stdout.write('ok')"];
const repoPath = os.tmpdir();

test("bd exec: a stalled bd call is killed and rejects with bd_timeout", async () => {
  const started = Date.now();
  await assert.rejects(
    runBdRaw(HANG, { repoPath, bin: fakeBd, timeoutMs: 300 }),
    (err: unknown) => {
      assert.ok(err instanceof BdError);
      assert.equal(err.code, "bd_timeout");
      assert.match(err.message, /timed out/);
      return true;
    },
  );
  assert.ok(Date.now() - started < 5000, "rejected well before the fake bd would exit on its own");
});

test("bd exec: after a timed-out call, the next call on the same repo runs", async () => {
  const key = `${repoPath}#timeout-chain`;
  const stalled = serializeWrite(key, () => runBdRaw(HANG, { repoPath, bin: fakeBd, timeoutMs: 300 }));
  const following = serializeWrite(key, () => runBdRaw(PRINT_OK, { repoPath, bin: fakeBd, timeoutMs: 5000 }));
  await assert.rejects(stalled, (err: unknown) => err instanceof BdError && err.code === "bd_timeout");
  assert.equal(await following, "ok");
});

test("bd exec: read-only commands get the short limit", () => {
  assert.ok(BD_READ_TIMEOUT_MS < BD_WRITE_TIMEOUT_MS);
  for (const args of [
    ["export", "--json"],
    ["show", "cc-1", "--json"],
    ["--readonly", "kv", "list", "--json"],
    ["kv", "get", "status.moved"],
    ["list", "--json"],
    ["search", "x"],
    ["ready"],
    ["--version"],
  ]) {
    assert.equal(bdTimeoutFor(args), BD_READ_TIMEOUT_MS, args.join(" "));
  }
});

test("bd exec: writes and unknown commands get the long limit", () => {
  for (const args of [
    ["create", "t", "-t", "task"],
    ["update", "cc-1", "-s", "closed"],
    ["close", "cc-1"],
    ["delete", "cc-1", "--force"],
    ["comment", "cc-1", "--", "hi"],
    ["dep", "add", "cc-1", "cc-2"],
    ["gate", "create", "--blocks", "cc-1"],
    ["label", "add", "cc-1", "archived"],
    ["kv", "set", "k", "v"],
    ["something-new"],
  ]) {
    assert.equal(bdTimeoutFor(args), BD_WRITE_TIMEOUT_MS, args.join(" "));
  }
});

// A fake bd that starts a detached grandchild sharing its stdout, writes the
// grandchild's pid to a file, then hangs. Killing the fake bd at the timeout
// leaves the grandchild holding the pipe, so execFile alone would not settle.
function holdStdoutArgs(pidFile: string): string[] {
  const code = `
    const { spawn } = require("node:child_process");
    const g = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], {
      detached: true,
      stdio: ["ignore", "inherit", "ignore"],
    });
    require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(g.pid));
    g.unref();
    setTimeout(() => {}, 30000);
  `;
  return ["-e", code];
}

test("bd exec: a bd whose grandchild keeps stdout open still rejects once, at the backstop", async () => {
  const pidFile = path.join(os.tmpdir(), `bd-exec-grandchild-${process.pid}.pid`);
  let settled = 0;
  const started = Date.now();
  try {
    await assert.rejects(
      runBdRaw(holdStdoutArgs(pidFile), { repoPath, bin: fakeBd, timeoutMs: 300 }).finally(() => {
        settled += 1;
      }),
      (err: unknown) => err instanceof BdError && err.code === "bd_timeout",
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2300 + 2500, `rejected at the backstop, not when the grandchild exits (${elapsed} ms)`);
    assert.equal(settled, 1);
  } finally {
    try {
      process.kill(Number(fs.readFileSync(pidFile, "utf8")));
    } catch {
      // Already gone.
    }
    fs.rmSync(pidFile, { force: true });
  }
});

test("bd exec: a fast call leaves no timer behind", async () => {
  const timers = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  const before = timers();
  assert.equal(await runBdRaw(PRINT_OK, { repoPath, bin: fakeBd, timeoutMs: 5000 }), "ok");
  assert.equal(timers(), before);
});

// The grandchild case above only hangs execFile on POSIX; on Windows the kill
// closes the pipe. These drive the backstop directly with a promise that never
// settles, so it is exercised on every platform.
test("bd exec: the backstop rejects a call that never settles, once, and fires its cleanup once", async () => {
  let fired = 0;
  const started = Date.now();
  await assert.rejects(
    withBackstop(new Promise<string>(() => {}), 200, () => {
      fired += 1;
    }),
    (err: unknown) => (err as { code?: string }).code === "ETIMEDOUT",
  );
  assert.ok(Date.now() - started >= 190);
  assert.equal(fired, 1);
});

test("bd exec: the backstop clears its timer when the call settles first", async () => {
  const timers = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  const before = timers();
  let fired = 0;
  assert.equal(await withBackstop(Promise.resolve("ok"), 60_000, () => (fired += 1)), "ok");
  await assert.rejects(withBackstop(Promise.reject(new Error("boom")), 60_000, () => (fired += 1)), /boom/);
  assert.equal(timers(), before);
  assert.equal(fired, 0);
});

test("bd exec: a timed-out bd --version maps to a bd_timeout that says so", async () => {
  const err = await pExecFile(fakeBd, HANG, { timeout: 300, killSignal: "SIGTERM" }).catch((e: unknown) => e);
  const mapped = asBdTimeout(err, ["--version"], 15_000);
  assert.ok(mapped instanceof BdError);
  assert.equal(mapped.code, "bd_timeout");
  assert.match(mapped.message, /^bd --version timed out after 15s/);
  assert.equal(asBdTimeout(new Error("Command failed"), ["--version"], 15_000), undefined);
});

test("bd exec: bdVersion returns the trimmed version line", async () => {
  // node answers --version like bd does: one line on stdout.
  assert.equal(await bdVersion(repoPath, fakeBd), process.version);
});
