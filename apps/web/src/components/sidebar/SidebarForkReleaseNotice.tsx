import { CircleArrowUpIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// Baked in by the fork's release workflow; empty in every other build, which hides the notice.
const RELEASE_TAG = import.meta.env.VITE_FORK_RELEASE_TAG;
const REPOSITORY = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface ForkRelease {
  readonly tag: string;
  readonly url: string;
}

async function fetchLatestRelease(signal: AbortSignal): Promise<ForkRelease | null> {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) return null;
  const { tag_name: tag, html_url: url } = body as Record<string, unknown>;
  return typeof tag === "string" && typeof url === "string" ? { tag, url } : null;
}

export function SidebarForkReleaseNotice() {
  const [latest, setLatest] = useState<ForkRelease | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Polls GitHub releases, an external system; the timer and request are cancelled on unmount.
  useEffect(() => {
    if (!RELEASE_TAG || !REPOSITORY) return;
    const controller = new AbortController();
    const check = () => {
      fetchLatestRelease(controller.signal).then(setLatest, () => {});
    };
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (!latest || latest.tag === RELEASE_TAG) return null;
  const label = `New fork build ${latest.tag} is available (you have ${RELEASE_TAG})`;

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
