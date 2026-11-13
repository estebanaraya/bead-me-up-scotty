import { test } from "node:test";
import assert from "node:assert/strict";
import { BdError } from "./bd-exec";
import { deferCreated } from "./bd-defer";

test("defer: a deferral that succeeds runs once and reports deferred", async () => {
  let runs = 0;
  const warnings: string[] = [];
  const deferred = await deferCreated("cc-1", async () => void runs++, (m) => warnings.push(m));
  assert.equal(deferred, true);
  assert.equal(runs, 1);
  assert.deepEqual(warnings, []);
});

test("defer: a deferral that keeps failing is tried twice, warned about, and does not throw", async () => {
  let runs = 0;
  const warnings: string[] = [];
  const fail = async () => {
    runs++;
    throw new BdError("database is locked");
  };
  const deferred = await deferCreated("cc-1", fail, (m) => warnings.push(m));
  assert.equal(deferred, false);
  assert.equal(runs, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /cc-1/);
  assert.match(warnings[0], /database is locked/);
});

test("defer: a timed-out deferral is not retried, so the repo queue is not held for a second limit", async () => {
  let runs = 0;
  const warnings: string[] = [];
  const timeout = async () => {
    runs++;
    throw new BdError("bd update timed out after 60s and was stopped", "bd_timeout");
  };
  const deferred = await deferCreated("cc-1", timeout, (m) => warnings.push(m));
  assert.equal(deferred, false);
  assert.equal(runs, 1);
  assert.equal(warnings.length, 1);
});
