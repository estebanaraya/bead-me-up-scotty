import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {
  BD_READ_TIMEOUT_MS,
  BD_WRITE_TIMEOUT_MS,
  BdError,
  bdTimeoutFor,
  runBdRaw,
  serializeWrite,
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
