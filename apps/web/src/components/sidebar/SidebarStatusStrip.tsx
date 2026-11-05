import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { isListedThreadLineage } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  ClockIcon,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { liveShellEnvironmentIdsAtom } from "../../state/shell";
import { environmentThreadShells } from "../../state/threads";
import { buildThreadRouteParams } from "../../threadRoutes";
import { resolveSidebarThreadStatus, type SidebarThreadStatus } from "../Sidebar.logic";
import { ScrollArea } from "../ui/scroll-area";
import { useSidebar } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const STATUS_INDICATORS = {
  approval: { label: "Approval needed", icon: CircleAlertIcon, color: "text-warning-foreground" },
  input: { label: "Input needed", icon: CircleAlertIcon, color: "text-warning-foreground" },
  request: { label: "Reply needed", icon: CircleAlertIcon, color: "text-warning-foreground" },
  working: { label: "Working", icon: CircleDashedIcon, color: "text-info-foreground" },
  waiting: { label: "Waiting", icon: ClockIcon, color: "text-muted-foreground" },
  failed: { label: "Failed", icon: CircleAlertIcon, color: "text-destructive" },
  limited: { label: "Usage limit", icon: CircleAlertIcon, color: "text-warning-foreground" },
  ready: { label: "Finished", icon: CircleCheckIcon, color: "text-success-foreground" },
} satisfies Record<
  SidebarThreadStatus,
  { label: string; icon: typeof CircleAlertIcon; color: string }
>;

function StatusStripThreads() {
  const threads = useAtomValue(environmentThreadShells.quietThreadShellsAtom);
  const liveEnvironments = useAtomValue(liveShellEnvironmentIdsAtom);

  return threads
    .filter((thread) => thread.archivedAt === null && isListedThreadLineage(thread.lineage))
    .map((thread) => {
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      const status = resolveSidebarThreadStatus(thread);
      const indicator = !liveEnvironments.has(thread.environmentId)
        ? { label: "Disconnected", icon: CircleDotIcon, color: "text-muted-foreground" }
        : status === "ready" && thread.latestRun === null
          ? { label: "Not started", icon: CircleDotIcon, color: "text-muted-foreground" }
          : STATUS_INDICATORS[status];
      const Icon = indicator.icon;
      const label = `${thread.title}: ${indicator.label}`;
      return (
        <Tooltip key={scopedThreadKey(ref)}>
          <TooltipTrigger
            render={
              <Link
                to="/$environmentId/$threadId"
                params={buildThreadRouteParams(ref)}
                aria-label={label}
                className="flex size-7 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                activeProps={{ className: "bg-accent", "aria-current": "page" }}
              />
            }
          >
            <Icon aria-hidden="true" className={cn("size-3.5", indicator.color)} />
          </TooltipTrigger>
          <TooltipPopup side="right">{label}</TooltipPopup>
        </Tooltip>
      );
    });
}

export function SidebarStatusStrip() {
  const { displayMode, isMobile, open, setHoverOpen } = useSidebar();
  if (isMobile || displayMode !== "strip" || open) return null;

  return (
    <nav
      aria-label="Chat status strip"
      data-sidebar-status-strip=""
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") setHoverOpen(true);
      }}
      className="fixed inset-y-0 left-0 z-20 flex w-(--sidebar-strip-width) flex-col border-r border-sidebar-border bg-sidebar pb-2 pt-(--workspace-topbar-height)"
    >
      <ScrollArea>
        <div className="flex flex-col items-center">
          <StatusStripThreads />
        </div>
      </ScrollArea>
    </nav>
  );
}
