import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

// lib/api.ts imports "server-only", so fail() runs in a child node with the
// react-server condition (as in bd-store-ids.test.ts). Next ships "next/server"
// without an exports map, which Node's ESM resolver needs, so the child maps it
// to "next/server.js" before importing api.ts.
const root = path.resolve(import.meta.dirname, "..");

const nextServerHook = `
export async function resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
}`;

const script = `
import { register } from "node:module";
import { BdError } from "./lib/bd-exec.ts";
register("data:text/javascript," + encodeURIComponent(${JSON.stringify(nextServerHook)}));
const { fail } = await import("./lib/api.ts");
const out = {};
for (const code of ["bd_timeout", "invalid_id"]) {
  const res = fail(new BdError("x", code));
  out[code] = { status: res.status, body: await res.json() };
}
process.stdout.write(JSON.stringify(out));
`;

test("api fail: bd_timeout maps to 504 and invalid_id to 400, each with its code", () => {
  const stdout = execFileSync(
    process.execPath,
    ["--conditions=react-server", "--no-warnings", "--import", "./scripts/ts-resolve.mjs", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8" },
  );
  const out = JSON.parse(stdout) as Record<string, { status: number; body: { code: string } }>;
  assert.equal(out.bd_timeout.status, 504);
  assert.equal(out.bd_timeout.body.code, "bd_timeout");
  assert.equal(out.invalid_id.status, 400);
  assert.equal(out.invalid_id.body.code, "invalid_id");
});
