import {
  AssistantCitation,
  EnvironmentId,
  ThreadId,
  type ChatImageAttachment,
  type OrchestrationV2ProjectedTurnItem,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import {
  collectShelfImages,
  createThreadShelfStore,
  THREAD_SHELF_STORAGE_KEY,
} from "./threadShelfStore";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  return { values, storage, store: createThreadShelfStore(storage) };
}

const decodeCitation = Schema.decodeSync(AssistantCitation);
function citation(environmentId = "environment-a") {
  return decodeCitation({
    version: 1,
    environmentId,
    threadId: "thread-1",
    messageId: "message-1",
    text: "Keep this passage",
    start: 4,
    end: 21,
    prefix: "The ",
    suffix: ".",
  });
}

function image(id: string): ChatImageAttachment {
  return { type: "image", id, name: `${id}.png`, mimeType: "image/png", sizeBytes: 42 };
}

describe("thread shelf persistence", () => {
  it("keeps the source selector, deduplicates pins, and isolates environments through reload and unpin", () => {
    const { store, storage } = setup();
    const first = citation();
    const other = citation("environment-b");
    store.getState().pin(first);
    store.getState().pin(first);
    store.getState().pin(other);
    const restored = createThreadShelfStore(storage);
    expect(restored.getState().shelves[scopedThreadKey(first)]?.pins).toEqual([first]);
    restored.getState().unpin(first);
    const reloaded = createThreadShelfStore(storage);
    expect(reloaded.getState().shelves[scopedThreadKey(first)]?.pins).toEqual([]);
    expect(reloaded.getState().shelves[scopedThreadKey(other)]?.pins).toEqual([other]);
  });

  it("retains images when history pages leave and keeps removed screenshots dismissed after reload", () => {
    const { store, storage } = setup();
    const ref = { environmentId: EnvironmentId.make("env"), threadId: ThreadId.make("thread") };
    store.getState().rememberImages(ref, [image("old")]);
    store.getState().rememberImages(ref, [image("new")]);
    store.getState().dismissImage(ref, "old");
    const restored = createThreadShelfStore(storage);
    restored.getState().rememberImages(ref, [image("new"), image("old")]);
    expect(restored.getState().shelves[scopedThreadKey(ref)]?.images).toEqual([
      image("new"),
      image("old"),
    ]);
    expect(restored.getState().shelves[scopedThreadKey(ref)]?.dismissedImages).toEqual(["old"]);
    restored.getState().restoreImages(ref);
    const reloaded = createThreadShelfStore(storage);
    expect(reloaded.getState().shelves[scopedThreadKey(ref)]?.dismissedImages).toEqual([]);
    expect(reloaded.getState().shelves[scopedThreadKey(ref)]?.images).toEqual([
      image("new"),
      image("old"),
    ]);
  });

  it("does not claim a pin was saved when storage rejects the write, and tolerates corrupt storage", () => {
    const { storage, values } = setup();
    values.set(THREAD_SHELF_STORAGE_KEY, "broken json");
    const store = createThreadShelfStore({
      ...storage,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(store.getState().pin(citation())).toBe(false);
    expect(store.getState().shelves).toEqual({});
    expect(values.get(THREAD_SHELF_STORAGE_KEY)).toBe("broken json");
  });

  it("collects user image attachments once without including agent attachments or unknown attachment types", () => {
    const row = (item: object) => ({ item }) as OrchestrationV2ProjectedTurnItem;
    const images = collectShelfImages([
      row({ type: "user_message", attachments: [image("one"), { type: "future" }] }),
      row({ type: "assistant_message", attachments: [image("assistant")] }),
      row({ type: "user_message", senderThreadId: "child", attachments: [image("agent")] }),
      row({ type: "user_message", attachments: [image("one"), image("two")] }),
    ]);
    expect(images).toEqual([image("two"), image("one")]);
  });
});
