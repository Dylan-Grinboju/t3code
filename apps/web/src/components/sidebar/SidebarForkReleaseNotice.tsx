import { useGT, useMessages } from "gt-react";
import { CircleArrowDownIcon, CircleArrowUpIcon, HourglassIcon } from "lucide-react";

import {
  FORK_RELEASE_TAG,
  forkUpdateActionLabel,
  resolveForkUpdateAction,
  runForkUpdateAction,
  useForkReleaseStatus,
} from "../../lib/forkRelease";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SidebarForkReleaseNotice() {
  const gt = useGT();
  const messages = useMessages();
  const snapshot = useForkReleaseStatus();
  const action = resolveForkUpdateAction(snapshot);
  if (action === null || action.kind === "check") return null;
  const busy = "busy" in action && action.busy;
  const actionLabel = forkUpdateActionLabel(action, messages);
  const tag = FORK_RELEASE_TAG;
  const label =
    action.kind === "install" && !busy
      ? snapshot.local?.message
        ? gt("{actionLabel} and restart (last try failed; you have {tag})", { actionLabel, tag })
        : gt("{actionLabel} and restart (you have {tag})", { actionLabel, tag })
      : gt("{actionLabel} (you have {tag})", { actionLabel, tag });
  const Icon = busy
    ? HourglassIcon
    : action.kind === "install"
      ? CircleArrowUpIcon
      : CircleArrowDownIcon;

  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label={label}
              aria-disabled={busy}
              onClick={() => runForkUpdateAction(action)}
              size="icon"
            >
              <Icon className={busy ? "text-muted-foreground" : "text-info-foreground"} />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
