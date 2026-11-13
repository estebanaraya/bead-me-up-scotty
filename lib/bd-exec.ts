import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unwrapEnvelope } from "./schema";

// No "server-only" import here, so node:test can load this module directly.
// Only lib/bd.ts (which is server-only) imports it.

export const pExecFile = promisify(execFile);
export const BD_BIN = process.env.BD_BIN || "bd";

export class BdError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "BdError";
    this.code = code;
  }
}

// A hung bd process would otherwise hold its repo's serializeWrite chain forever,
// stalling every later read and write for that project. Reads get a short limit;
// writes a longer one, since a write killed midway may or may not have landed.
export const BD_READ_TIMEOUT_MS = 15_000;
export const BD_WRITE_TIMEOUT_MS = 60_000;
const BD_KILL_SIGNAL = "SIGTERM";

// Commands that only read. Anything not listed (including commands added later)
// counts as a write and gets the longer limit.
const READ_ONLY_COMMANDS = new Set(["export", "show", "list", "search", "ready"]);
const READ_ONLY_KV = new Set(["get", "list"]);
const READ_ONLY_FLAGS = new Set(["--readonly", "--version"]);

/** The timeout for a bd argument list: short for read-only commands, long otherwise. */
export function bdTimeoutFor(args: string[]): number {
  // Only flags before the command word count, so user text later in the list can't pick the limit.
  const start = args.findIndex((a) => !a.startsWith("-"));
  const leading = start === -1 ? args : args.slice(0, start);
  if (leading.some((a) => READ_ONLY_FLAGS.has(a))) return BD_READ_TIMEOUT_MS;
  if (start === -1) return BD_WRITE_TIMEOUT_MS;
  const command = args[start];
  const sub = args[start + 1];
  if (READ_ONLY_COMMANDS.has(command)) return BD_READ_TIMEOUT_MS;
  if (command === "kv" && sub !== undefined && READ_ONLY_KV.has(sub)) return BD_READ_TIMEOUT_MS;
  return BD_WRITE_TIMEOUT_MS;
}

type ExecError = { stderr?: string; message?: string; killed?: boolean; signal?: string | null; code?: unknown };

/** Node marks a child it killed for running past `timeout` as killed, with the kill signal. */
function isTimeout(e: ExecError): boolean {
  if (e.code === "ETIMEDOUT") return true;
  return e.killed === true && e.signal === BD_KILL_SIGNAL && e.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
}

// At the timeout execFile destroys its ends of bd's pipes and sends SIGTERM, then
// settles when bd exits. A bd that ignores SIGTERM or is stuck never exits, so
// execFile never settles. The backstop rejects this long after the timeout
// whatever execFile does, and SIGKILLs bd.
export const BD_BACKSTOP_GRACE_MS = 2000;

/**
 * Settles with `pending`, or rejects with an ETIMEDOUT error after `ms` and calls
 * `onFire` once. The timer never outlives the call.
 */
export async function withBackstop<T>(pending: Promise<T>, ms: number, onFire: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const backstop = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // A throwing cleanup must neither stop the rejection nor escape this timer
      // callback as an uncaught exception (which try/finally alone would allow).
      let cleanupError: unknown;
      try {
        onFire();
      } catch (e) {
        // Cleanup is best effort; the call still rejects below, carrying it as the cause.
        cleanupError = e;
      }
      const options = cleanupError === undefined ? undefined : { cause: cleanupError };
      reject(Object.assign(new Error(`no exit within ${ms} ms`, options), { code: "ETIMEDOUT" }));
    }, ms);
  });
  try {
    return await Promise.race([pending, backstop]);
  } finally {
    clearTimeout(timer);
  }
}

/** execFile with a SIGTERM at `timeout` and the backstop (SIGKILL) just after it. */
function execBounded(bin: string, args: string[], options: { cwd: string; timeout: number; env?: NodeJS.ProcessEnv }) {
  const pending = pExecFile(bin, args, { ...options, killSignal: BD_KILL_SIGNAL, maxBuffer: 32 * 1024 * 1024 });
  return withBackstop(pending, options.timeout + BD_BACKSTOP_GRACE_MS, () => {
    // SIGKILL cannot be ignored, so bd exits and execFile settles too.
    try {
      pending.child.kill("SIGKILL");
    } catch {
      // Invalid or unsupported signal on this platform; best effort.
    }
  });
}

/** The bd_timeout error for a call killed at its limit, or undefined if `err` is not a timeout. */
export function asBdTimeout(err: unknown, args: string[], timeout: number): BdError | undefined {
  if (!err || typeof err !== "object" || !isTimeout(err as ExecError)) return undefined;
  const command = args.find((a) => !a.startsWith("-")) ?? args[0] ?? "";
  return new BdError(`bd ${command} timed out after ${timeout / 1000}s and was stopped`, "bd_timeout");
}

/** `bd --version`, trimmed. A hang rejects with bd_timeout; other failures pass through. */
export async function bdVersion(repoPath: string, bin = BD_BIN, timeout = BD_READ_TIMEOUT_MS): Promise<string> {
  const args = ["--version"];
  try {
    const { stdout } = await execBounded(bin, args, { cwd: repoPath, timeout });
    return stdout.trim();
  } catch (err) {
    throw asBdTimeout(err, args, timeout) ?? err;
  }
}

export type BdRunOpts = { repoPath: string; actor?: string; bin?: string; timeoutMs?: number };

/**
 * Run a bd command. Args are passed as an array (no shell) so titles and
 * descriptions are injection-safe. Always requests the JSON envelope.
 */
export async function runBdRaw(args: string[], opts: BdRunOpts): Promise<string> {
  const timeout = opts.timeoutMs ?? bdTimeoutFor(args);
  try {
    const { stdout } = await execBounded(opts.bin ?? BD_BIN, args, {
      cwd: opts.repoPath,
      timeout,
      env: {
        ...process.env,
        BD_JSON_ENVELOPE: "1",
        ...(opts.actor ? { BEADS_ACTOR: opts.actor } : {}),
      },
    });
    return stdout;
  } catch (err: unknown) {
    const timedOut = asBdTimeout(err, args, timeout);
    if (timedOut) throw timedOut;
    const e = err as ExecError;
    // bd emits a JSON error object to stderr with a `code` when --json is active.
    const stderr = (e.stderr || "").trim();
    try {
      const parsed = JSON.parse(stderr) as { error?: string; code?: string };
      if (parsed.error) throw new BdError(parsed.error, parsed.code);
    } catch (parseErr) {
      if (parseErr instanceof BdError) throw parseErr;
    }
    // bd emits the pending-migration block as PLAIN-TEXT stderr, not the JSON
    // envelope, so it would otherwise fall through uncoded and dump ~200 words
    // of raw text into a toast. Tag it here so the UI keys off a stable code
    // rather than string-matching in React. (gastownhall/beads#4259)
    if (/pending schema migration|BD_ALLOW_REMOTE_MIGRATE|#4259/i.test(stderr)) {
      throw new BdError(stderr, "schema_migration_required");
    }
    throw new BdError(stderr || e.message || "bd command failed");
  }
}

export async function runBdJson<T = unknown>(args: string[], opts: BdRunOpts): Promise<T> {
  const out = await runBdRaw([...args, "--json"], opts);
  return unwrapEnvelope(JSON.parse(out)) as T;
}

// ---- bd serialization (embedded Dolt is single-writer *per database*) ----
// EVERY bd invocation — including read-only `export`/`show` — rewrites the
// embedded-Dolt store, so reads MUST serialize with writes too. Running them
// concurrently corrupts persists ("Unable to write SST file …") and collides on
// compaction ("Another write batch or compaction is already active").
// Keyed by repoPath so same-project bd calls serialize while different projects
// run in parallel.
const writeChains = new Map<string, Promise<unknown>>();
export function serializeWrite<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(repoPath) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeChains.set(
    repoPath,
    next.catch(() => {}),
  );
  return next;
}
