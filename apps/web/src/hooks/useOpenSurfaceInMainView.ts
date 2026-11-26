import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";

import { isSideChatOf, promoteThreadTab } from "../lib/threadTabs";
import { readThreadShell } from "../state/entities";
import { type LinkedThreadSurface, linkedThreadRouteParams } from "../linkedThreadSurface";
import { type ThreadSurface, useRightPanelStore } from "../rightPanelStore";
import { buildThreadRouteParams } from "../threadRoutes";

/**
 * Moves a side thread's tab from `panelRef`'s panel to the main screen. The tab closes, without
 * the cleanup Close does, so the way back does not show the thread beside itself.
 */
export function useOpenSurfaceInMainView(panelRef: ScopedThreadRef | null) {
  const navigate = useNavigate();
  return (surface: ThreadSurface | LinkedThreadSurface) => {
    if (panelRef === null) return;
    if (surface.kind === "linked-thread") {
      useRightPanelStore.getState().closeSurface(panelRef, surface.id);
      void navigate({
        to: "/linked/$viaEnvironmentId/$linkedEnvironmentId/$linkedThreadId",
        params: linkedThreadRouteParams(surface),
      });
      return;
    }
    const target = scopeThreadRef(panelRef.environmentId, surface.threadId);
    const shell = readThreadShell(target);
    if (shell !== null && !isSideChatOf(shell, panelRef)) {
      promoteThreadTab(panelRef, surface.threadId, { closeHost: false });
    } else {
      useRightPanelStore.getState().closeSurface(panelRef, surface.id);
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(target),
    });
  };
}
