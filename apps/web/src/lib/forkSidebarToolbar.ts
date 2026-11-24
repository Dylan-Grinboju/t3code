import { Schema } from "effect";

import { useLocalStorage } from "../hooks/useLocalStorage";

export function useHideSidebarToolbar() {
  return useLocalStorage("t3code:fork-hide-sidebar-toolbar", false, Schema.Boolean);
}
