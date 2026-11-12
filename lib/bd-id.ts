import { BdError } from "./bd-exec";

// An issue id starts with a letter or digit, then letters, digits, ".", "_" or "-".
// The leading character rule is the point: an id from a URL that starts with "-"
// would be read by bd as a flag once it lands in an argument list.
const ISSUE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Throws BdError `invalid_id` (HTTP 400) unless `id` is a well-formed issue id. */
export function assertIssueId(id: string): void {
  if (typeof id !== "string" || !ISSUE_ID.test(id)) {
    throw new BdError(`Invalid issue id: ${JSON.stringify(String(id)).slice(0, 80)}`, "invalid_id");
  }
}
