import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { threadTabAttention } from "../lib/threadTabAttention";
import { useUiStateStore } from "../uiStateStore";

export function useThreadTabStatus(shell: EnvironmentThreadShell | null) {
  const key =
    shell === null ? null : scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id));
  const localLastVisitedAt = useUiStateStore((state) =>
    key === null ? undefined : state.threadLastVisitedAtById[key],
  );
  return threadTabAttention(shell, localLastVisitedAt);
}
