import { Schema } from "effect";

import { useLocalStorage } from "../hooks/useLocalStorage";

export function useHideSidebarPullRequests() {
  return useLocalStorage("t3code:fork-hide-sidebar-pull-requests", false, Schema.Boolean);
}

export function useHideSidebarIssues() {
  return useLocalStorage("t3code:fork-hide-sidebar-issues", false, Schema.Boolean);
}
