import { test } from "node:test";
import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import os from "node:os";
import {
  BD_READ_TIMEOUT_MS,
  BD_WRITE_TIMEOUT_MS,
  BD_BACKSTOP_GRACE_MS,
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

// Fails the test instead of hanging it when `p` never settles.
function settlesWithin<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms);
  });
  return Promise.race([p, deadline]).finally(() => clearTimeout(timer));
}

// Makes every child ignore the SIGTERM that execFile sends at the timeout, on any
// platform (Windows cannot ignore a real one). Other signals pass through, and
// each child seen is SIGKILLed afterwards so none outlives the test. `signals`
// records what the code under test sent.
async function withSigtermIgnored<T>(fn: (signals: Array<string | number | undefined>) => Promise<T>): Promise<T> {
  const original = ChildProcess.prototype.kill;
  const seen = new Set<ChildProcess>();
  const signals: Array<string | number | undefined> = [];
  ChildProcess.prototype.kill = function (this: ChildProcess, signal?: NodeJS.Signals | number) {
    seen.add(this);
    signals.push(signal);
    // Node passes the signal as a name or, from its own timeout timer, as a number.
    const term = signal === "SIGTERM" || signal === os.constants.signals.SIGTERM;
    return term ? false : original.call(this, signal);
  };
  try {
    return await fn(signals);
  } finally {
    ChildProcess.prototype.kill = original;
    for (const child of seen) child.kill("SIGKILL");
  }
}

const HANG_FOREVER = ["-e", "setInterval(() => {}, 1000)"];
const BACKSTOP_AT = 300 + BD_BACKSTOP_GRACE_MS;

test("bd exec: runBdRaw rejects once with bd_timeout at the backstop when the kill does not stop bd", async () => {
  let settled = 0;
  const started = Date.now();
  const sent = await withSigtermIgnored(async (signals) => {
    await assert.rejects(
      settlesWithin(
        runBdRaw(HANG_FOREVER, { repoPath, bin: fakeBd, timeoutMs: 300 }).finally(() => (settled += 1)),
        BACKSTOP_AT + 1500,
      ),
      (err: unknown) => err instanceof BdError && err.code === "bd_timeout",
    );
    return [...signals];
  });
  assert.ok(Date.now() - started >= BACKSTOP_AT - 50, "rejected by the backstop, not by the ignored kill");
  assert.equal(settled, 1);
  assert.ok(sent.includes("SIGKILL"), `the backstop sent SIGKILL (sent: ${sent.join(", ")})`);
});

// A real bd that ignores SIGTERM. POSIX only: Windows kills with TerminateProcess,
// which a process cannot ignore. The fake exits on its own after 15 s at most.
const IGNORES_SIGTERM = ["-e", 'process.on("SIGTERM", () => {}); setTimeout(() => process.exit(0), 15000)'];

test(
  "bd exec: a bd that ignores SIGTERM is SIGKILLed and rejects once with bd_timeout",
  { skip: process.platform === "win32" },
  async () => {
    const started = Date.now();
    await assert.rejects(
      settlesWithin(runBdRaw(IGNORES_SIGTERM, { repoPath, bin: fakeBd, timeoutMs: 300 }), BACKSTOP_AT + 1500),
      (err: unknown) => err instanceof BdError && err.code === "bd_timeout",
    );
    assert.ok(Date.now() - started >= BACKSTOP_AT - 50);
  },
);

test("bd exec: a fast call leaves no timer behind", async () => {
  const timers = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
  const before = timers();
  assert.equal(await runBdRaw(PRINT_OK, { repoPath, bin: fakeBd, timeoutMs: 5000 }), "ok");
  assert.equal(timers(), before);
});

// These drive the backstop directly with a promise that never settles, so it is
// exercised on every platform.
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

test("bd exec: the backstop still rejects when its cleanup throws", async () => {
  const pending = withBackstop(new Promise<string>(() => {}), 50, () => {
    throw new Error("cleanup failed");
  });
  await assert.rejects(settlesWithin(pending, 2000), (err: unknown) => (err as { code?: string }).code === "ETIMEDOUT");
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
