import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";

import { promoteThreadTab, threadTabSurfaces } from "../../lib/threadTabs";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { useQuietThreadShell } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * Closes the main chat while threads are open as its tabs: the active thread tab, or the first,
 * takes its place along with the other thread tabs. The closed thread stays in the sidebar.
 */
export function MainThreadCloseButton(props: { readonly threadRef: ScopedThreadRef }) {
  const { threadRef } = props;
  const navigate = useNavigate();
  const nextThreadId = useRightPanelStore((state) => {
    const panel = selectThreadRightPanelState(state.byThreadKey, threadRef);
    const tabs = threadTabSurfaces(panel, threadRef);
    return (tabs.find((tab) => tab.id === panel.activeSurfaceId) ?? tabs[0])?.threadId ?? null;
  });
  const next = useQuietThreadShell(
    nextThreadId === null ? null : scopeThreadRef(threadRef.environmentId, nextThreadId),
  );
  if (nextThreadId === null) return null;
  const close = () => {
    const target = promoteThreadTab(threadRef, nextThreadId, { closeHost: true });
    void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(target) });
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-xs" aria-label="Close main chat" onClick={close}>
            <XIcon />
          </Button>
        }
      />
      <TooltipPopup side="bottom">
        Close this chat. {next?.title ?? "The next thread tab"} takes its place.
      </TooltipPopup>
    </Tooltip>
  );
}
