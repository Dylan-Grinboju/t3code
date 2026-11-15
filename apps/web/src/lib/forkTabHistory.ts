import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Schema } from "effect";

import {
  readLocalStorageValue,
  subscribeLocalStorageKey,
  useLocalStorage,
} from "../hooks/useLocalStorage";
import { type ThreadRightPanelState, useRightPanelStore } from "../rightPanelStore";
import type { AppRouter } from "../router";
import { resolveThreadRouteRef } from "../threadRoutes";

/**
 * Fork: switching right panel tabs (or the maximized chat tab) adds a history entry on the same
 * URL, so Back and Forward, including mouse thumb buttons, step through tabs before threads.
 */
export interface PanelTabView {
  readonly isOpen: boolean;
  readonly activeSurfaceId: string | null;
  readonly maximized: boolean;
  readonly chatTabActive: boolean;
}

export interface PanelTabStep {
  readonly threadKey: string;
  readonly before: PanelTabView;
  readonly after: PanelTabView;
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    forkPanelTab?: PanelTabStep;
  }
}

const TAB_HISTORY_KEY = "t3code:fork-tab-history";
const THREAD_ROUTE_ID = "/_chat/$environmentId/$threadId";

export function useTabHistory() {
  return useLocalStorage(TAB_HISTORY_KEY, false, Schema.Boolean);
}

export function panelTabView(state: ThreadRightPanelState | undefined): PanelTabView {
  return {
    isOpen: state?.isOpen ?? false,
    activeSurfaceId: state?.activeSurfaceId ?? null,
    maximized: state?.maximized === true,
    chatTabActive: state?.chatTabActive === true,
  };
}

/** The tab the user sees: null for the main chat, otherwise the active panel surface. */
export function shownTab(view: PanelTabView): string | null {
  if (!view.isOpen || (view.maximized && view.chatTabActive)) return null;
  return view.activeSurfaceId;
}

/**
 * The panel with `view` applied, or null when the step is not worth stopping on: its tab has
 * closed since, or the panel already shows it.
 */
function restorePanelTabView(
  current: ThreadRightPanelState | undefined,
  view: PanelTabView,
): ThreadRightPanelState | null {
  if (current === undefined || shownTab(panelTabView(current)) === shownTab(view)) return null;
  if (
    view.activeSurfaceId !== null &&
    !current.surfaces.some((surface) => surface.id === view.activeSurfaceId)
  ) {
    return null;
  }
  const { maximized: _maximized, chatTabActive: _chatTabActive, ...rest } = current;
  return {
    ...rest,
    isOpen: view.isOpen,
    // Back to the chat keeps the panel's tab for when it reopens.
    activeSurfaceId: view.activeSurfaceId ?? current.activeSurfaceId,
    ...(view.maximized ? { maximized: true as const } : {}),
    ...(view.maximized && view.chatTabActive ? { chatTabActive: true as const } : {}),
  };
}

function routeThreadKey(router: AppRouter): string | null {
  const match = router.state.matches.find((entry) => entry.routeId === THREAD_ROUTE_ID);
  const ref = match === undefined ? null : resolveThreadRouteRef(match.params);
  return ref === null ? null : scopedThreadKey(ref);
}

export function startTabHistory(router: AppRouter): void {
  let enabled = readLocalStorageValue(TAB_HISTORY_KEY, false, Schema.Boolean);
  subscribeLocalStorageKey(TAB_HISTORY_KEY, () => {
    enabled = readLocalStorageValue(TAB_HISTORY_KEY, false, Schema.Boolean);
  });

  let restoring = false;
  let pending = false;

  useRightPanelStore.subscribe((state, previous) => {
    if (!enabled || restoring || pending || state.byThreadKey === previous.byThreadKey) return;
    const threadKey = routeThreadKey(router);
    if (threadKey === null) return;
    const before = panelTabView(previous.byThreadKey[threadKey]);
    if (shownTab(before) === shownTab(panelTabView(state.byThreadKey[threadKey]))) return;
    const href = router.history.location.href;
    pending = true;
    // One tab switch can take several store writes; record where they settle.
    queueMicrotask(() => {
      pending = false;
      // A navigation started meanwhile; pushing the old URL would undo it.
      if (router.history.location.href !== href || routeThreadKey(router) !== threadKey) return;
      const after = panelTabView(useRightPanelStore.getState().byThreadKey[threadKey]);
      if (shownTab(before) === shownTab(after)) return;
      router.history.push(href, { forkPanelTab: { threadKey, before, after } });
    });
  });

  // The router reports a one-entry traversal as GO when its history index is missing, as it is
  // after the pairing redirect; the Navigation API (Chromium only) still knows the step.
  let traversalDelta: number | null = null;
  if ("navigation" in window) {
    window.navigation.addEventListener("currententrychange", (event) => {
      const index = window.navigation.currentEntry?.index;
      traversalDelta =
        event.navigationType === "traverse" && index !== undefined && event.from.index >= 0
          ? index - event.from.index
          : null;
    });
  }

  let lastState = router.history.location.state;
  router.history.subscribe(({ location, action }) => {
    const departed = lastState;
    lastState = location.state;
    const delta = traversalDelta;
    traversalDelta = null;
    if (!enabled) return;
    const back = action.type === "BACK" || (action.type === "GO" && delta === -1);
    if (!back && action.type !== "FORWARD" && !(action.type === "GO" && delta === 1)) return;
    const step = back ? departed.forkPanelTab : location.state.forkPanelTab;
    if (step === undefined) return;
    const restored = restorePanelTabView(
      useRightPanelStore.getState().byThreadKey[step.threadKey],
      back ? step.before : step.after,
    );
    if (restored === null) {
      if (back) router.history.back();
      else router.history.forward();
      return;
    }
    restoring = true;
    try {
      useRightPanelStore.setState((current) => ({
        byThreadKey: { ...current.byThreadKey, [step.threadKey]: restored },
      }));
    } finally {
      restoring = false;
    }
  });
}
