import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  hostRightPanel,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../rightPanelStore";
import {
  newSubagentParentId,
  openSubagentTab,
  promoteThreadTab,
  startSubagentThreadTabs,
  threadTabSurfaceId,
} from "./threadTabs";

const mocks = vi.hoisted(() => ({
  shells: new Map<string, unknown>(),
  proactivePanelsEnabled: true,
  fullScreen: false,
  listeners: new Map<string, Set<(value: unknown) => void>>(),
}));

vi.mock("../state/entities", () => ({
  readThreadShell: (ref: { environmentId: string; threadId: string }) =>
    mocks.shells.get(`${ref.environmentId}:${ref.threadId}`) ?? null,
}));
vi.mock("../state/threads", () => ({
  environmentThreadShells: {
    threadRefsAtom: "refs",
    threadShellAtom: (ref: { environmentId: string; threadId: string }) =>
      `shell:${ref.environmentId}:${ref.threadId}`,
  },
}));
vi.mock("../rpc/atomRegistry", () => ({
  subscribeAtomChanges: (atom: string, listener: (value: unknown) => void) => {
    const listeners = mocks.listeners.get(atom) ?? new Set();
    listeners.add(listener);
    mocks.listeners.set(atom, listeners);
    return () => listeners.delete(listener);
  },
}));
vi.mock("./forkPanelTabs", () => ({ readPanelAlwaysFullScreen: () => mocks.fullScreen }));
vi.mock("../hooks/useSettings", () => ({
  getClientSettings: () => ({ proactivePanelsEnabled: mocks.proactivePanelsEnabled }),
}));

const environmentId = "env-1" as EnvironmentId;
const ref = (id: string) => scopeThreadRef(environmentId, ThreadId.make(id));
const main = ref("main");

function shell(
  id: string,
  lineage: Partial<EnvironmentThreadShell["lineage"]> = {},
  createdAt = "2026-11-10T12:00:00.000Z",
) {
  return {
    id: ThreadId.make(id),
    projectId: "project-1",
    createdAt,
    lineage: { parentThreadId: null, relationshipToParent: null, sideChat: false, ...lineage },
  } as unknown as EnvironmentThreadShell;
}

function setup(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  proactivePanelsEnabled = true,
  fullScreen = false,
) {
  mocks.shells.clear();
  mocks.listeners.clear();
  for (const entry of shells) mocks.shells.set(`${environmentId}:${entry.id}`, entry);
  mocks.proactivePanelsEnabled = proactivePanelsEnabled;
  mocks.fullScreen = fullScreen;
  useRightPanelStore.setState({
    byThreadKey: {},
    threadPanelVisibilityByThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
}

const panel = (threadRef: ReturnType<typeof ref>) =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
const surfaceIds = (threadRef: ReturnType<typeof ref>) =>
  panel(threadRef).surfaces.map((surface) => surface.id);

describe("promoteThreadTab", () => {
  it("swaps the main thread with a tab, keeping side chats and other surfaces where they were", () => {
    setup([
      shell("main"),
      shell("a"),
      shell("b"),
      shell("side", { sideChat: true, parentThreadId: ThreadId.make("main") }),
    ]);
    const store = useRightPanelStore.getState();
    store.open(main, "diff");
    store.openSideChat(main, ThreadId.make("side"));
    store.openSideChat(main, ThreadId.make("a"));
    store.openSideChat(main, ThreadId.make("b"));

    const target = promoteThreadTab(main, ThreadId.make("a"), { closeHost: false });

    expect(target).toEqual(ref("a"));
    expect(surfaceIds(main)).toEqual(["diff", threadTabSurfaceId(ThreadId.make("side"))]);
    expect(surfaceIds(ref("a"))).toEqual([
      threadTabSurfaceId(ThreadId.make("main")),
      threadTabSurfaceId(ThreadId.make("b")),
    ]);
    expect(panel(ref("a"))).toMatchObject({
      isOpen: true,
      activeSurfaceId: threadTabSurfaceId(ThreadId.make("main")),
    });
  });

  it("closing the main thread hands its thread tabs to the next one without adding itself", () => {
    setup([shell("main"), shell("a"), shell("b")]);
    const store = useRightPanelStore.getState();
    store.openSideChat(main, ThreadId.make("a"));
    store.openSideChat(main, ThreadId.make("b"));

    promoteThreadTab(main, ThreadId.make("a"), { closeHost: true });

    expect(panel(main)).toMatchObject({ isOpen: false, surfaces: [], activeSurfaceId: null });
    expect(surfaceIds(ref("a"))).toEqual([threadTabSurfaceId(ThreadId.make("b"))]);
    expect(panel(ref("a")).activeSurfaceId).toBe(threadTabSurfaceId(ThreadId.make("b")));
  });

  it("drops a tab of the new main thread that would show itself", () => {
    setup([shell("main"), shell("a")]);
    useRightPanelStore.getState().openSideChat(main, ThreadId.make("a"));
    useRightPanelStore.getState().openSideChat(ref("a"), ThreadId.make("a"));

    promoteThreadTab(main, ThreadId.make("a"), { closeHost: false });

    expect(surfaceIds(ref("a"))).toEqual([threadTabSurfaceId(ThreadId.make("main"))]);
  });
});

describe("openSubagentTab", () => {
  it("opens a closed panel on the subagent, but leaves a panel showing something else", () => {
    setup([shell("main"), shell("child")]);

    openSubagentTab(main, ThreadId.make("child"));
    expect(panel(main)).toMatchObject({
      isOpen: true,
      activeSurfaceId: threadTabSurfaceId(ThreadId.make("child")),
    });

    useRightPanelStore.getState().open(main, "diff");
    openSubagentTab(main, ThreadId.make("second"));
    expect(panel(main).activeSurfaceId).toBe("diff");
    expect(surfaceIds(main)).toContain(threadTabSurfaceId(ThreadId.make("second")));
  });

  it("adds the tab without opening the panel when proactive panels are off", () => {
    setup([shell("main"), shell("child")], false);

    openSubagentTab(main, ThreadId.make("child"));

    expect(panel(main).isOpen).toBe(false);
    expect(surfaceIds(main)).toEqual([threadTabSurfaceId(ThreadId.make("child"))]);
  });

  it("opens the panel maximized with the main chat in view when panels always open full screen", () => {
    setup([shell("main"), shell("child")], false, true);

    openSubagentTab(main, ThreadId.make("child"));

    expect(panel(main)).toMatchObject({ isOpen: true, maximized: true, chatTabActive: true });
    expect(surfaceIds(main)).toEqual([threadTabSurfaceId(ThreadId.make("child"))]);
  });

  it("goes to the main thread while the parent is itself a tab there", () => {
    setup([shell("main"), shell("parent"), shell("child")]);
    const stopHosting = hostRightPanel(ref("parent"), main);

    openSubagentTab(ref("parent"), ThreadId.make("child"));
    stopHosting();

    expect(surfaceIds(main)).toEqual([threadTabSurfaceId(ThreadId.make("child"))]);
    expect(
      useRightPanelStore.getState().byThreadKey[scopedThreadKey(ref("parent"))],
    ).toBeUndefined();
  });
});

describe("newSubagentParentId", () => {
  const now = Date.parse("2026-11-10T12:00:30.000Z");

  it("names the parent of a subagent started within the last minute only", () => {
    const parent = ThreadId.make("main");
    expect(
      newSubagentParentId(
        shell("child", { parentThreadId: parent, relationshipToParent: "subagent" }),
        now,
      ),
    ).toBe(parent);
    expect(
      newSubagentParentId(
        shell(
          "old",
          { parentThreadId: parent, relationshipToParent: "subagent" },
          "2026-11-10T11:00:00.000Z",
        ),
        now,
      ),
    ).toBeNull();
    expect(
      newSubagentParentId(
        shell("fork", { parentThreadId: parent, relationshipToParent: "fork" }),
        now,
      ),
    ).toBeNull();
  });
});

describe("startSubagentThreadTabs", () => {
  const emit = (atom: string, value: unknown) => {
    for (const listener of mocks.listeners.get(atom) ?? []) listener(value);
  };

  it("opens the tab once the shell of a ref that arrived without one loads", () => {
    setup([shell("main")]);
    using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-10T12:00:05.000Z"));
    startSubagentThreadTabs();
    const child = shell("child", {
      parentThreadId: ThreadId.make("main"),
      relationshipToParent: "subagent",
    });

    emit("refs", [main, ref("child")]);
    expect(surfaceIds(main)).toEqual([]);

    mocks.shells.set(`${environmentId}:child`, child);
    emit(`shell:${environmentId}:child`, child);

    expect(surfaceIds(main)).toEqual([threadTabSurfaceId(ThreadId.make("child"))]);
  });
});
