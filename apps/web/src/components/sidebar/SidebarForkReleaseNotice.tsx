import { CircleArrowUpIcon } from "lucide-react";

import { ensureLocalApi } from "../../localApi";
import { FORK_RELEASE_TAG, newerForkRelease, useForkReleaseStatus } from "../../lib/forkRelease";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SidebarForkReleaseNotice() {
  const latest = newerForkRelease(useForkReleaseStatus());
  if (!latest) return null;
  const label = `New fork build ${latest.tag} is available (you have ${FORK_RELEASE_TAG})`;

  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label={label}
              onClick={() => void ensureLocalApi().shell.openExternal(latest.url)}
              size="icon"
            >
              <CircleArrowUpIcon className="text-info-foreground" />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
