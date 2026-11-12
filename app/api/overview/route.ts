import fs from "node:fs";
import path from "node:path";
import { getConfig, DEMO_PROJECT, type ProjectEntry } from "@/lib/config";
import { createBdStore, readKv } from "@/lib/bd";
import type { BeadsStore } from "@/lib/store";
import { ok, fail } from "@/lib/api";
import { buildHome, buildTile, emptyTile, type Kv, type Tile } from "@/lib/overview";

export const dynamic = "force-dynamic";

const PROJECT_TIMEOUT_MS = 10_000;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The home's own read-only stores, one per repo path. Deliberately not
 * `getStore`: that records the project as opened, which rewrites Scotty's
 * config file, and this page must not write anything.
 */
const stores = new Map<string, BeadsStore>();
function homeStore(repoPath: string): BeadsStore {
  let store = stores.get(repoPath);
  if (!store) {
    store = createBdStore(repoPath);
    stores.set(repoPath, store);
  }
  return store;
}

/** Beads and the lead's status for one project. A failed kv read only loses the status. */
async function readProject(project: ProjectEntry, now: Date): Promise<Tile> {
  const [beads, kv] = await Promise.all([
    homeStore(project.path).list(),
    readKv(project.path).catch((): Kv => ({})),
  ]);
  return buildTile(project, beads, kv, now, getConfig().humanActor);
}

/** One project, never throwing: no `.beads` folder, a thrown read and a stall each become a state. */
async function loadProject(project: ProjectEntry, now: Date): Promise<Tile> {
  if (!fs.existsSync(path.join(project.path, ".beads"))) return emptyTile(project, "not-on-beads");
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out after 10s")), PROJECT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([readProject(project, now), timeout]);
  } catch (e) {
    return emptyTile(project, "error", message(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Every configured project as a tile, plus the one ask per project that needs Esteban now. */
export async function GET() {
  try {
    const now = new Date();
    const projects = getConfig().projects.filter((p) => p.id !== DEMO_PROJECT.id);
    const tiles = await Promise.all(projects.map((p) => loadProject(p, now)));
    return ok(buildHome(tiles, now));
  } catch (e) {
    return fail(e);
  }
}
