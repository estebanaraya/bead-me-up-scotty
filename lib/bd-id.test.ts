import { test } from "node:test";
import assert from "node:assert/strict";
import { BdError } from "./bd-exec";
import { assertIssueId } from "./bd-id";

test("bd id: real issue ids pass", () => {
  for (const id of ["cc-2ar.3", "am-llw.58", "bd-5q", "A1", "x_y-z.9"]) {
    assert.doesNotThrow(() => assertIssueId(id), id);
  }
});

test("bd id: anything bd could read as a flag or a path is rejected with invalid_id", () => {
  for (const id of ["--foo", "--foo=bar", "-x", "", "a b", "a/b", "../x", ".hidden", "_x", "a\\b", "a\nb", "cc-1;rm"]) {
    assert.throws(
      () => assertIssueId(id),
      (err: unknown) => err instanceof BdError && err.code === "invalid_id",
      JSON.stringify(id),
    );
  }
});

test("bd id: non-string input is rejected with invalid_id", () => {
  for (const id of [undefined, null, 42]) {
    assert.throws(
      () => assertIssueId(id as unknown as string),
      (err: unknown) => err instanceof BdError && err.code === "invalid_id",
    );
  }
});
