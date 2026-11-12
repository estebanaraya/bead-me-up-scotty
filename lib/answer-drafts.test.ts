import { test } from "node:test";
import assert from "node:assert/strict";
import { clearDraft, draftKey, readDraft, writeDraft, type DraftStorage } from "./answer-drafts";

/** A Storage stand-in over a Map, so the tests see exactly what was persisted. */
function fakeStorage(): DraftStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  };
}

/** Storage that refuses every access, as in a blocked or private context. */
const throwing: DraftStorage = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
  removeItem: () => {
    throw new Error("denied");
  },
};

test("draft key: one per issue in its project", () => {
  assert.equal(draftKey("jaque", "ja-12"), "jaque:ja-12");
  assert.notEqual(draftKey("jaque", "ja-12"), draftKey("studio", "ja-12"));
});

test("drafts: written text reads back from storage, under a prefixed key", () => {
  const store = fakeStorage();
  writeDraft("jaque:ja-12", "Steam first.", store);
  assert.equal(readDraft("jaque:ja-12", store), "Steam first.");
  assert.equal([...store.items.keys()].length, 1);
  assert.notEqual([...store.items.keys()][0], "jaque:ja-12");
});

test("drafts: a missing draft reads as empty", () => {
  assert.equal(readDraft("jaque:none", fakeStorage()), "");
});

test("drafts: clearing removes it; writing empty text clears too", () => {
  const store = fakeStorage();
  writeDraft("jaque:ja-12", "Steam first.", store);
  clearDraft("jaque:ja-12", store);
  assert.equal(readDraft("jaque:ja-12", store), "");
  writeDraft("jaque:ja-13", "Keep it.", store);
  writeDraft("jaque:ja-13", "", store);
  assert.equal(readDraft("jaque:ja-13", store), "");
  assert.equal(store.items.size, 0);
});

test("drafts: storage that throws falls back to memory, never throws", () => {
  writeDraft("jaque:ja-20", "Kept in memory.", throwing);
  assert.equal(readDraft("jaque:ja-20", throwing), "Kept in memory.");
  clearDraft("jaque:ja-20", throwing);
  assert.equal(readDraft("jaque:ja-20", throwing), "");
});

test("drafts: no storage at all (server render) falls back to memory", () => {
  writeDraft("jaque:ja-21", "No storage here.", null);
  assert.equal(readDraft("jaque:ja-21", null), "No storage here.");
  clearDraft("jaque:ja-21", null);
  assert.equal(readDraft("jaque:ja-21", null), "");
});

test("drafts: a failed write never leaves an older stored draft to win", () => {
  const store = fakeStorage();
  writeDraft("jaque:ja-30", "old", store);
  const full: DraftStorage = { ...store, setItem: () => { throw new Error("quota"); } };
  writeDraft("jaque:ja-30", "newer", full);
  assert.equal(readDraft("jaque:ja-30", full), "newer");
  // Once storage accepts writes again, the stored copy is the truth and memory steps aside.
  writeDraft("jaque:ja-30", "newest", store);
  assert.equal(readDraft("jaque:ja-30", store), "newest");
});
