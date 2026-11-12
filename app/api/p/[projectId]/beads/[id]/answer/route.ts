import { getStore } from "@/lib/store";
import { getConfig } from "@/lib/config";
import { ok, fail } from "@/lib/api";
import { BdError } from "@/lib/bd";
import { ANSWER_MAX, answerAlreadySaved, labelFailure } from "@/lib/answer";
import { runExclusive } from "@/lib/per-key-queue";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; id: string }> };

const bodySchema = z.object({ text: z.string().trim().min(1).max(ANSWER_MAX) });

/**
 * Answer an ask from the home: post Esteban's answer as a comment, then label
 * the issue `answered`. Status is unchanged; the project's lead acts on the
 * answer and closes the issue (kit:lead step 1). Resending is safe: when the
 * newest comment on the issue is already his answer with this text, only the
 * label is written. A label failure keeps bd's error code (labelFailure). Requests for
 * one issue run one at a time, so two sends cannot both pass the duplicate check.
 * Viewer mode is enforced by proxy.ts, like every other write under /api/p/.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    const { text } = bodySchema.parse(await req.json());
    return await runExclusive(`${projectId}:${id}`, async () => {
      // list() (bd export) is the source the home reads answers from, comments included.
      const current = (await store.list()).find((b) => b.id === id);
      if (!current) return fail(new BdError(`No issue ${id} in this project.`, "not_found"));
      if (!answerAlreadySaved(current.comments, cfg.humanActor, text)) {
        await store.addComment(id, text, cfg.humanActor);
      }
      try {
        return ok(await store.addLabel(id, "answered", cfg.humanActor));
      } catch (e) {
        return fail(labelFailure(e));
      }
    });
  } catch (e) {
    return fail(e);
  }
}
