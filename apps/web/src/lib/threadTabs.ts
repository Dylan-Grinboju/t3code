import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { getClientSettings } from "../hooks/useSettings";
import {
  type RightPanelSurface,
  type ThreadRightPanelState,
  rightPanelHostRef,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../rightPanelStore";
import { subscribeAtomChanges } from "../rpc/atomRegistry";
import { readThreadShell } from "../state/entities";
import { readPanelAlwaysFullScreen } from "./forkPanelTabs";
import { environmentThreadShells } from "../state/threads";

/**
 * Fork: any thread can sit in another thread's right panel as a tab. Tabs ride on the side chat
 * surface, which already embeds a thread's chat, persists, and reopens; the pane tells a real
 * side chat of the host apart from a thread tab.
 */
export type ThreadTabSurface = Extract<RightPanelSurface, { kind: "side-chat" }>;

export const threadTabSurfaceId = (threadId: ThreadId) => `side-chat:${threadId}` as const;

export function isSideChatOf(
  shell: Pick<EnvironmentThreadShell, "lineage"> | null,
  host: ScopedThreadRef,
): boolean {
  return shell?.lineage.sideChat === true && shell.lineage.parentThreadId === host.threadId;
}

/** Thread tabs in `state`, leaving out side chats of the host and threads not loaded yet. */
export function threadTabSurfaces(
  state: ThreadRightPanelState,
  host: ScopedThreadRef,
  readShell: (ref: ScopedThreadRef) => EnvironmentThreadShell | null = readThreadShell,
): ThreadTabSurface[] {
  return state.surfaces.filter((surface): surface is ThreadTabSurface => {
    if (surface.kind !== "side-chat" || surface.threadId === host.threadId) return false;
    const shell = readShell(scopeThreadRef(host.environmentId, surface.threadId));
    return shell !== null && !isSideChatOf(shell, host);
  });
}

/** Whether `threadId` can open as a tab of `host`: another loaded thread on the same machine. */
export function canOpenAsThreadTab(host: ScopedThreadRef | null, target: ScopedThreadRef): boolean {
  if (host === null || host.environmentId !== target.environmentId) return false;
  if (host.threadId === target.threadId) return false;
  return readThreadShell(host) !== null && readThreadShell(target) !== null;
}

export function openThreadTab(host: ScopedThreadRef, threadId: ThreadId): void {
  useRightPanelStore.getState().openSideChat(host, threadId);
}

function withoutSurfaces(
  current: ThreadRightPanelState,
  surfaceIds: ReadonlySet<string>,
): ThreadRightPanelState {
  const surfaces = current.surfaces.filter((surface) => !surfaceIds.has(surface.id));
  if (surfaces.length === current.surfaces.length) return current;
  const activeSurfaceId =
    current.activeSurfaceId !== null && surfaceIds.has(current.activeSurfaceId)
      ? (surfaces.at(-1)?.id ?? null)
      : current.activeSurfaceId;
  return {
    ...current,
    surfaces,
    activeSurfaceId,
    ...(surfaces.length === 0 ? { isOpen: false } : {}),
  };
}

function withSurfaces(
  current: ThreadRightPanelState,
  added: ReadonlyArray<ThreadTabSurface>,
  activeSurfaceId: string | null,
): ThreadRightPanelState {
  const known = new Set(current.surfaces.map((surface) => surface.id));
  const surfaces = [...current.surfaces, ...added.filter((surface) => !known.has(surface.id))];
  if (surfaces.length === 0) return current;
  return {
    ...current,
    isOpen: true,
    surfaces,
    activeSurfaceId: activeSurfaceId ?? current.activeSurfaceId ?? surfaces[0]?.id ?? null,
  };
}

/**
 * Makes the tab for `threadId` the main thread: its panel takes the host's other thread tabs,
 * plus the host itself as a tab unless `closeHost`. Writes the store directly because the tab's
 * pane routes its own panel actions to the host until it unmounts. Returns the new main thread.
 */
export function promoteThreadTab(
  host: ScopedThreadRef,
  threadId: ThreadId,
  options: { readonly closeHost: boolean },
): ScopedThreadRef {
  const target = scopeThreadRef(host.environmentId, threadId);
  const hostKey = scopedThreadKey(host);
  const targetKey = scopedThreadKey(target);
  useRightPanelStore.setState((state) => {
    const hostState = selectThreadRightPanelState(state.byThreadKey, host);
    const moved = threadTabSurfaces(hostState, host).filter(
      (surface) => surface.threadId !== threadId,
    );
    const hostTab: ThreadTabSurface = {
      id: threadTabSurfaceId(host.threadId),
      kind: "side-chat",
      threadId: host.threadId,
    };
    const added = options.closeHost ? moved : [hostTab, ...moved];
    const removed = new Set([threadTabSurfaceId(threadId), ...moved.map((surface) => surface.id)]);
    const targetState = selectThreadRightPanelState(state.byThreadKey, target);
    return {
      byThreadKey: {
        ...state.byThreadKey,
        [hostKey]: withoutSurfaces(hostState, removed),
        [targetKey]: withSurfaces(
          // The new main must not list itself.
          withoutSurfaces(targetState, new Set([threadTabSurfaceId(threadId)])),
          added,
          options.closeHost ? null : hostTab.id,
        ),
      },
    };
  });
  return target;
}

/** Subagents started within this window count as new; older ones come from a snapshot. */
const NEW_SUBAGENT_WINDOW_MS = 60_000;

/**
 * Adds a tab for a new subagent to the panel showing its parent: the parent's own, or the main
 * thread's while the parent is itself a tab there. It takes focus only when the panel has nothing
 * else showing, and opens a closed panel only with proactive panels on.
 */
export function openSubagentTab(parent: ScopedThreadRef, threadId: ThreadId): void {
  const host = rightPanelHostRef(parent);
  const hostKey = scopedThreadKey(host);
  const surface: ThreadTabSurface = {
    id: threadTabSurfaceId(threadId),
    kind: "side-chat",
    threadId,
  };
  const fullScreen = readPanelAlwaysFullScreen();
  const openPanel = fullScreen || getClientSettings().proactivePanelsEnabled;
  useRightPanelStore.setState((state) => {
    const current = selectThreadRightPanelState(state.byThreadKey, host);
    if (current.surfaces.some((entry) => entry.id === surface.id)) return state;
    const idle = !current.isOpen || current.activeSurfaceId === null;
    const added: ThreadRightPanelState = {
      ...current,
      surfaces: [...current.surfaces, surface],
      isOpen: current.isOpen || openPanel,
      activeSurfaceId: idle ? surface.id : current.activeSurfaceId,
    };
    const next: ThreadRightPanelState =
      fullScreen && !(current.isOpen && current.maximized)
        ? { ...added, maximized: true, chatTabActive: true }
        : added;
    return { byThreadKey: { ...state.byThreadKey, [hostKey]: next } };
  });
}

/** The parent of a subagent thread an agent just started, or null for any other thread. */
export function newSubagentParentId(shell: EnvironmentThreadShell, nowMs: number): ThreadId | null {
  if (shell.lineage.relationshipToParent !== "subagent") return null;
  if (nowMs - Date.parse(shell.createdAt) > NEW_SUBAGENT_WINDOW_MS) return null;
  return shell.lineage.parentThreadId;
}

function openTabIfNewSubagent(shell: EnvironmentThreadShell, ref: ScopedThreadRef): void {
  const parentId = newSubagentParentId(shell, Date.now());
  if (parentId !== null) openSubagentTab(scopeThreadRef(ref.environmentId, parentId), shell.id);
}

/** Opens a tab under the parent thread for each subagent thread an agent starts. */
export function startSubagentThreadTabs(): void {
  const handled = new Set<string>();
  const waiting = new Map<string, () => void>();
  subscribeAtomChanges(environmentThreadShells.threadRefsAtom, (refs) => {
    const present = new Set<string>();
    for (const ref of refs) {
      const key = scopedThreadKey(ref);
      present.add(key);
      if (handled.has(key)) continue;
      handled.add(key);
      const shell = readThreadShell(ref);
      if (shell !== null) {
        openTabIfNewSubagent(shell, ref);
        continue;
      }
      const stop = subscribeAtomChanges(environmentThreadShells.threadShellAtom(ref), (next) => {
        if (next === null) return;
        waiting.get(key)?.();
        waiting.delete(key);
        openTabIfNewSubagent(next, ref);
      });
      waiting.set(key, stop);
    }
    for (const [key, stop] of waiting) {
      if (present.has(key)) continue;
      stop();
      waiting.delete(key);
    }
  });
}
