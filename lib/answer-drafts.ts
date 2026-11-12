/**
 * Unsent answers, kept outside the answer box so a draft outlives the box: a refetch that
 * drops the ask from its list, viewer mode, a reload in the same tab. One draft per issue,
 * so an ask that leaves the strip reopens from its tile with the text intact.
 *
 * sessionStorage holds drafts; when it is missing or refuses access, a module-level Map
 * does. Memory holds a key only while storage cannot, so the two never disagree.
 */

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "scotty.answer-draft:";
const memory = new Map<string, string>();

/** The draft key for one issue in one project. */
export function draftKey(projectId: string, issueId: string): string {
  return `${projectId}:${issueId}`;
}

function sessionStore(): DraftStorage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function tryRemove(store: DraftStorage | null, key: string): void {
  try {
    store?.removeItem(PREFIX + key);
  } catch {
    // Storage refused; memory is already authoritative for this key.
  }
}

/** The saved draft for a key, or "" when there is none. Never throws. */
export function readDraft(key: string, store: DraftStorage | null = sessionStore()): string {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return store?.getItem(PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

/** Saves the draft; empty text clears it. Never throws. */
export function writeDraft(key: string, text: string, store: DraftStorage | null = sessionStore()): void {
  if (text === "") return clearDraft(key, store);
  try {
    if (!store) throw new Error("no storage");
    store.setItem(PREFIX + key, text);
    memory.delete(key);
  } catch {
    memory.set(key, text);
    tryRemove(store, key);
  }
}

/** Removes the draft from storage and memory. Never throws. */
export function clearDraft(key: string, store: DraftStorage | null = sessionStore()): void {
  memory.delete(key);
  tryRemove(store, key);
}
