import "server-only";
import fs from "node:fs";
import path from "node:path";
import { beadSchema, type Bead, type CreateInput, type UpdateInput, type DepType } from "./schema";
import type { BeadsStore, DoctorInfo } from "./store";
import { BD_BIN, BD_READ_TIMEOUT_MS, BdError, pExecFile, runBdJson, runBdRaw, serializeWrite } from "./bd-exec";
import { assertIssueId } from "./bd-id";

export { BdError };

/** Parse `bd export --json` JSONL output into validated beads. */
function parseExport(jsonl: string): Bead[] {
  const beads: Bead[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const parsed = beadSchema.safeParse(obj);
    // Skip memory/non-issue records (they lack required issue fields).
    if (parsed.success && parsed.data.issue_type) beads.push(parsed.data);
  }
  return beads;
}

const inflightKv = new Map<string, Promise<Record<string, unknown>>>();

/**
 * The project's `bd kv` pairs, read-only. Keys are bare (`status.moved`).
 * Leads write `status.*` for the home page; other keys (memories) are ignored
 * by callers. Concurrent callers for one repo share a single read.
 */
export function readKv(repoPath: string): Promise<Record<string, unknown>> {
  const hit = inflightKv.get(repoPath);
  if (hit) return hit;
  const run = serializeWrite(repoPath, async () => {
    const data = await runBdJson<unknown>(["--readonly", "kv", "list"], { repoPath });
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  }).finally(() => inflightKv.delete(repoPath));
  inflightKv.set(repoPath, run);
  return run;
}

const availabilityCache = new Map<string, boolean>();

export async function isBdAvailable(repoPath: string): Promise<boolean> {
  const hit = availabilityCache.get(repoPath);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    await pExecFile(BD_BIN, ["--version"], { timeout: 5000 });
    ok = fs.existsSync(path.join(repoPath, ".beads"));
  } catch {
    ok = false;
  }
  availabilityCache.set(repoPath, ok);
  return ok;
}

export function createBdStore(repoPath: string): BeadsStore {
  const ro = { repoPath };
  const rw = (actor: string) => ({ repoPath, actor });
  // Collapse concurrent list() callers (the polling views) onto one in-flight export.
  let inflightList: Promise<Bead[]> | null = null;

  /**
   * Checks every issue id (undefined entries are absent optionals) and only then
   * queues `fn`, so a flag-shaped id never reaches a bd argument list or the queue.
   */
  function withIds<T>(ids: Array<string | undefined>, fn: () => Promise<T>): Promise<T> {
    try {
      for (const id of ids) if (id !== undefined) assertIssueId(id);
    } catch (e) {
      return Promise.reject(e);
    }
    return serializeWrite(repoPath, fn);
  }

  async function show(id: string): Promise<Bead> {
    assertIssueId(id);
    // bd 1.0.5 `show <id> --json` returns its envelope `data` as an ARRAY even
    // for a single id, while beadSchema expects one object. Unwrap before parse.
    const data = await runBdJson(["show", id], ro);
    const rec = Array.isArray(data) ? data[0] : data;
    if (!rec) throw new BdError(`bead ${id} not found`, "not_found");
    const parsed = beadSchema.safeParse(rec);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new BdError(`could not parse bead ${id}: ${detail}`, "parse_error");
    }
    return parsed.data;
  }

  return {
    kind: "bd",

    async list() {
      // Dedupe concurrent callers onto one in-flight export, and serialize that
      // export with all other bd ops so reads can't collide with writes/compaction.
      if (inflightList) return inflightList;
      inflightList = serializeWrite(repoPath, async () =>
        parseExport(await runBdRaw(["export", "--json"], ro)),
      );
      try {
        return await inflightList;
      } finally {
        inflightList = null;
      }
    },

    async get(id) {
      // Serialized too — `bd show` rewrites the store like any other invocation.
      return withIds([id], async () => {
        try {
          return await show(id);
        } catch (e) {
          if (e instanceof BdError && e.code === "not_found") return null;
          throw e;
        }
      });
    },

    create(input: CreateInput, actor: string) {
      return withIds([input.parent || undefined], async () => {
        const args = [
          "create",
          input.title,
          "-t",
          input.issue_type,
          "--priority",
          String(input.priority),
        ];
        if (input.description) args.push("--description", input.description);
        if (input.assignee) args.push("--assignee", input.assignee);
        if (input.labels?.length) args.push("-l", input.labels.join(","));
        if (input.parent) args.push("--parent", input.parent);
        const created = await runBdJson<{ id: string }>(args, rw(actor));
        const id = created.id;
        if (input.backlog) {
          await runBdRaw(["update", id, "-s", "deferred"], rw(actor));
        }
        return show(id);
      });
    },

    update(id, patch: UpdateInput, actor: string) {
      return withIds([id, patch.parent || undefined], async () => {
        const args = ["update", id];
        if (patch.title !== undefined) args.push("--title", patch.title);
        if (patch.description !== undefined) args.push("--description", patch.description);
        if (patch.status !== undefined) args.push("-s", patch.status);
        if (patch.priority !== undefined) args.push("--priority", String(patch.priority));
        if (patch.issue_type !== undefined) args.push("-t", patch.issue_type);
        if (patch.assignee !== undefined) args.push("--assignee", patch.assignee);
        // `!== undefined` rather than a truthiness check: `""` is the detach
        // signal, so `if (patch.parent)` would make detaching inexpressible.
        if (patch.parent !== undefined) args.push("--parent", patch.parent);
        // Labels are replace-all. `bd update --set-labels ""` is silently
        // dropped (verified against bd 1.1.0) — an empty value never clears —
        // so the "remove every label" case has to go through --remove-label
        // with the bead's current labels instead.
        if (patch.labels !== undefined) {
          if (patch.labels.length) {
            args.push("--set-labels", patch.labels.join(","));
          } else {
            const current = (await show(id)).labels ?? [];
            if (current.length) args.push("--remove-label", current.join(","));
          }
        }
        // `bd update <id>` with no field flags is a no-op error; skip the call
        // when clearing labels on a bead that had none.
        if (args.length > 2) await runBdRaw(args, rw(actor));
        return show(id);
      });
    },

    setStatus(id, status, actor, reason) {
      return withIds([id], async () => {
        if (status === "closed") {
          const args = ["close", id];
          // Only `bd close --reason` persists a close reason, and re-closing an
          // already-closed bead won't overwrite it — so this is the one chance
          // to record why. Args go through execFile, so prose is safe verbatim.
          const trimmed = reason?.trim();
          if (trimmed) args.push("--reason", trimmed);
          await runBdRaw(args, rw(actor));
        } else {
          await runBdRaw(["update", id, "-s", status], rw(actor));
        }
        return show(id);
      });
    },

    remove(id, actor) {
      return withIds([id], async () => {
        await runBdRaw(["delete", id, "--force"], rw(actor));
      });
    },

    addComment(id, text, actor) {
      return withIds([id], async () => {
        // `--` ends flag parsing, so comment text starting with "-" stays text, not a flag.
        await runBdRaw(["comment", id, "--", text], rw(actor));
        return show(id);
      });
    },

    addDep(id, dependsOnId, type: DepType, actor) {
      return withIds([id, dependsOnId], async () => {
        await runBdRaw(["dep", "add", id, dependsOnId, "-t", type], rw(actor));
        return show(id);
      });
    },

    removeDep(id, dependsOnId, actor) {
      return withIds([id, dependsOnId], async () => {
        await runBdRaw(["dep", "remove", id, dependsOnId], rw(actor));
        return show(id);
      });
    },

    createGate(blocks, reason, actor) {
      return withIds([blocks], async () => {
        const args = ["gate", "create", "--type", "human", "--blocks", blocks];
        if (reason) args.push("--reason", reason);
        // `bd gate create --json` returns the created gate object (incl. its id).
        const created = await runBdJson<{ id: string }>(args, rw(actor));
        return show(created.id);
      });
    },

    removeLabel(id, label, actor) {
      return withIds([id], async () => {
        await runBdRaw(["update", id, "--remove-label", label], rw(actor));
        return show(id);
      });
    },

    addLabel(id, label, actor) {
      return withIds([id], async () => {
        await runBdRaw(["update", id, "--add-label", label], rw(actor));
        return show(id);
      });
    },

    archive(id, actor) {
      return withIds([id], async () => {
        await runBdRaw(["close", id], rw(actor));
        await runBdRaw(["label", "add", id, "archived"], rw(actor));
        return show(id);
      });
    },

    async doctor(): Promise<DoctorInfo> {
      try {
        const { stdout } = await pExecFile(BD_BIN, ["--version"], { cwd: repoPath, timeout: BD_READ_TIMEOUT_MS });
        return {
          kind: "bd",
          ok: true,
          version: stdout.trim(),
          repoPath,
          message: `Connected to bd at ${repoPath}`,
        };
      } catch (e) {
        return {
          kind: "bd",
          ok: false,
          repoPath,
          message: (e as Error).message,
        };
      }
    },
  };
}
