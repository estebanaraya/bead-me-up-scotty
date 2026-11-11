import fs from "node:fs";
import path from "node:path";
import { getStore } from "@/lib/store";
import { getConfig, DEMO_PROJECT, type ProjectEntry } from "@/lib/config";
import { queryEvents, type EventRow } from "@/lib/bd";
import { ok, fail } from "@/lib/api";
import {
  buildOverview,
  buildProject,
  cutoffIso,
  emptyProject,
  toActivity,
  type ActivityItem,
  type ProjectOverview,
} from "@/lib/overview";

export const dynamic = "force-dynamic";

const PROJECT_TIMEOUT_MS = 10_000;

type Part = { project: ProjectOverview; activity: ActivityItem[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Both reads for one project. A failed events query degrades to "activity unavailable". */
async function readProject(project: ProjectEntry, cutoff: string): Promise<Part> {
  const store = await getStore(project.id);
  const [beads, events] = await Promise.all([
    store.list(),
    queryEvents(project.path, cutoff).catch((): EventRow[] | null => null),
  ]);
  return {
    project: buildProject(project, beads, events, cutoff),
    activity: toActivity(project, events ?? []),
  };
}

/** One project, never throwing: no `.beads` folder, a thrown read and a stall each become a state. */
async function loadProject(project: ProjectEntry, cutoff: string): Promise<Part> {
  if (!fs.existsSync(path.join(project.path, ".beads"))) {
    return { project: emptyProject(project, "not-on-beads"), activity: [] };
  }
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out after 10s")), PROJECT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([readProject(project, cutoff), timeout]);
  } catch (e) {
    return { project: emptyProject(project, "error", message(e)), activity: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** Everything in flight across every configured project, plus the last 24 hours of audit activity. */
export async function GET() {
  try {
    const now = new Date();
    const cutoff = cutoffIso(now);
    const projects = getConfig().projects.filter((p) => p.id !== DEMO_PROJECT.id);
    const parts = await Promise.all(projects.map((p) => loadProject(p, cutoff)));
    return ok(buildOverview(parts, now));
  } catch (e) {
    return fail(e);
  }
}
