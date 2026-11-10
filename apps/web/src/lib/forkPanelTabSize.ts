import { Schema } from "effect";

import {
  readLocalStorageValue,
  subscribeLocalStorageKey,
  useLocalStorage,
} from "../hooks/useLocalStorage";
import "./forkPanelTabSize.css";

const TAB_SIZE_KEY = "t3code:fork-panel-tab-size";

const PanelTabSize = Schema.Literals(["default", "large", "larger"]);
export type PanelTabSize = typeof PanelTabSize.Type;

export function usePanelTabSize() {
  return useLocalStorage<PanelTabSize, PanelTabSize>(TAB_SIZE_KEY, "default", PanelTabSize);
}

export function startPanelTabSize(): void {
  const apply = () => {
    const size = readLocalStorageValue<PanelTabSize, PanelTabSize>(
      TAB_SIZE_KEY,
      "default",
      PanelTabSize,
    );
    if (size === "default") delete document.documentElement.dataset.forkPanelTabSize;
    else document.documentElement.dataset.forkPanelTabSize = size;
  };
  apply();
  subscribeLocalStorageKey(TAB_SIZE_KEY, apply);
}
