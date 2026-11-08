import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  AssistantCitation,
  ChatImageAttachment,
  type OrchestrationV2ProjectedTurnItem,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { create } from "zustand";

const Shelf = Schema.Struct({
  pins: Schema.Array(AssistantCitation),
  images: Schema.Array(ChatImageAttachment),
  dismissedImages: Schema.Array(Schema.String),
});
export type ThreadShelf = typeof Shelf.Type;
const Shelves = Schema.Record(Schema.String, Shelf);
const decodeShelves = Schema.decodeUnknownSync(Shelves);
const isImageAttachment = Schema.is(ChatImageAttachment);
export const THREAD_SHELF_STORAGE_KEY = "t3code:thread-shelves:v1";
export const EMPTY_THREAD_SHELF: ThreadShelf = { pins: [], images: [], dismissedImages: [] };

export function shelfPinKey(citation: AssistantCitation) {
  return JSON.stringify([citation.messageId, citation.start, citation.end, citation.text]);
}

export function collectShelfImages(items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>) {
  const images = new Map<string, ChatImageAttachment>();
  for (const { item } of items) {
    if (item.type !== "user_message" || item.senderThreadId) continue;
    for (const attachment of item.attachments) {
      if (isImageAttachment(attachment)) images.set(attachment.id, attachment);
    }
  }
  return [...images.values()].reverse();
}

interface ThreadShelfStore {
  shelves: Record<string, ThreadShelf>;
  pin: (citation: AssistantCitation) => boolean;
  unpin: (citation: AssistantCitation) => boolean;
  rememberImages: (ref: ScopedThreadRef, images: ReadonlyArray<ChatImageAttachment>) => boolean;
  dismissImage: (ref: ScopedThreadRef, imageId: string) => boolean;
  restoreImages: (ref: ScopedThreadRef) => boolean;
}

export function createThreadShelfStore(storage: Pick<Storage, "getItem" | "setItem">) {
  let shelves: Record<string, ThreadShelf> = {};
  try {
    const raw = storage.getItem(THREAD_SHELF_STORAGE_KEY);
    if (raw) shelves = decodeShelves(JSON.parse(raw));
  } catch {
    // A corrupt or inaccessible local shelf must not prevent the thread opening.
  }
  return create<ThreadShelfStore>()((set, get) => {
    const update = (ref: ScopedThreadRef, change: (shelf: ThreadShelf) => ThreadShelf) => {
      const key = scopedThreadKey(ref);
      const current = get().shelves[key] ?? EMPTY_THREAD_SHELF;
      const next = change(current);
      if (next === current) return true;
      const nextShelves = { ...get().shelves, [key]: next };
      try {
        storage.setItem(THREAD_SHELF_STORAGE_KEY, JSON.stringify(nextShelves));
      } catch {
        return false;
      }
      set({ shelves: nextShelves });
      return true;
    };
    return {
      shelves,
      pin: (citation) =>
        update(citation, (shelf) =>
          shelf.pins.some((pin) => shelfPinKey(pin) === shelfPinKey(citation))
            ? shelf
            : { ...shelf, pins: [citation, ...shelf.pins] },
        ),
      unpin: (citation) =>
        update(citation, (shelf) => ({
          ...shelf,
          pins: shelf.pins.filter((pin) => shelfPinKey(pin) !== shelfPinKey(citation)),
        })),
      rememberImages: (ref, images) =>
        update(ref, (shelf) => {
          const known = new Set([
            ...shelf.images.map((image) => image.id),
            ...shelf.dismissedImages,
          ]);
          const added = images.filter((image) => !known.has(image.id));
          return added.length ? { ...shelf, images: [...added, ...shelf.images] } : shelf;
        }),
      dismissImage: (ref, imageId) =>
        update(ref, (shelf) => ({
          ...shelf,
          dismissedImages: [...new Set([...shelf.dismissedImages, imageId])],
        })),
      restoreImages: (ref) => update(ref, (shelf) => ({ ...shelf, dismissedImages: [] })),
    };
  });
}

export const useThreadShelfStore = createThreadShelfStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
