import { Schema } from "effect";

import {
  readLocalStorageValue,
  subscribeLocalStorageKey,
  useLocalStorage,
} from "../hooks/useLocalStorage";
import { type ThreadRightPanelState, useRightPanelStore } from "../rightPanelStore";

const FULL_SCREEN_KEY = "t3code:fork-panel-always-full-screen";

const FullScreen = Schema.Boolean;

export function usePanelAlwaysFullScreen() {
  return useLocalStorage(FULL_SCREEN_KEY, false, FullScreen);
}

export function readPanelAlwaysFullScreen(): boolean {
  return readLocalStorageValue(FULL_SCREEN_KEY, false, FullScreen);
}

const showsTab = (state: ThreadRightPanelState | undefined) =>
  state !== undefined && state.isOpen && state.surfaces.length > 0;

export function maximizeNewlyShownPanels(
  next: Readonly<Record<string, ThreadRightPanelState>>,
  previous: Readonly<Record<string, ThreadRightPanelState>>,
): Record<string, ThreadRightPanelState> | null {
  const updates: Record<string, ThreadRightPanelState> = {};
  for (const [key, state] of Object.entries(next)) {
    if (state.maximized || !showsTab(state) || showsTab(previous[key])) continue;
    updates[key] = { ...state, maximized: true };
  }
  return Object.keys(updates).length === 0 ? null : updates;
}

export function startPanelAlwaysFullScreen(): void {
  let enabled = readPanelAlwaysFullScreen();
  subscribeLocalStorageKey(FULL_SCREEN_KEY, () => {
    enabled = readPanelAlwaysFullScreen();
  });
  useRightPanelStore.subscribe((state, previous) => {
    if (!enabled || state.byThreadKey === previous.byThreadKey) return;
    const updates = maximizeNewlyShownPanels(state.byThreadKey, previous.byThreadKey);
    if (updates === null) return;
    useRightPanelStore.setState((current) => ({
      byThreadKey: { ...current.byThreadKey, ...updates },
    }));
  });
}
