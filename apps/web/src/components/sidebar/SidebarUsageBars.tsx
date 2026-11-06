import { useAtomValue } from "@effect/atom-react";
import { refreshUsageLimits } from "@t3tools/client-runtime/state/usage";
import {
  collectLimitAccounts,
  collectLimitPools,
  formatDuration,
} from "@t3tools/shared/usageLimits";
import { GaugeIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useEffect, useEffectEvent, type ReactNode } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { barColor } from "../usage/UsageLimits";
import { sidebarUsageRows, type SidebarUsageRow } from "./sidebarUsage";

const REFRESH_INTERVAL_MS = 10 * 60_000;
// Within this many points of even pace reads as on pace.
const ON_PACE_POINTS = 5;

/** Keeps provider limits fresh while the sidebar shows them; the shared throttle spaces the probes. */
function useLimitsAutoRefresh() {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const refresh = useEffectEvent(() => {
    if (document.visibilityState !== "visible") return;
    for (const [environmentId, presentation] of presentations) {
      if (presentation.connection.phase !== "connected" || presentation.serverConfig === null)
        continue;
      void refreshUsageLimits(
        environmentId,
        () => refreshProviders({ environmentId, input: {} }),
        true,
      ).catch(() => {});
    }
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- polls provider limits on the server while the sidebar is mounted, on focus and on an interval
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
}

function paceText(row: SidebarUsageRow) {
  const delta = row.projection?.paceDelta;
  if (delta === undefined) return null;
  if (Math.abs(delta) < ON_PACE_POINTS) return "On pace";
  return delta > 0 ? `${delta}% faster than the window` : `${-delta}% slower than the window`;
}

function projectionText(row: SidebarUsageRow, now: number) {
  const projection = row.projection;
  if (!projection) return null;
  if (projection.runsOutBeforeResetMs !== null) {
    return projection.runsOutBeforeResetMs <= 60_000
      ? "At this rate it runs out right at the reset."
      : `At this rate it runs out ${formatDuration(projection.runsOutBeforeResetMs)} before the reset.`;
  }
  const resetsIn = row.resetsAt === null ? "" : ` in ${formatDuration(row.resetsAt - now)}`;
  return `At this rate ${projection.leftAtReset}% is left when it resets${resetsIn}.`;
}

function UsageBarRow({ row }: { readonly row: SidebarUsageRow }) {
  const color = barColor(row.driver);
  const delta = row.projection?.paceDelta ?? null;
  const PaceGlyph =
    delta === null
      ? null
      : Math.abs(delta) < ON_PACE_POINTS
        ? GaugeIcon
        : delta > 0
          ? TrendingUpIcon
          : TrendingDownIcon;
  return (
    <span className="grid grid-cols-[0.75rem_minmax(0,1fr)_0.625rem] items-center gap-1.5">
      <ProviderInstanceIcon
        driverKind={row.driver}
        displayName={row.label}
        className="size-3"
        iconClassName="size-3"
      />
      <span className="relative h-1.5 min-w-0 rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full opacity-70"
          style={{ width: `${row.remainingPercent}%`, backgroundColor: color }}
        />
        {row.evenPacePercent !== null ? (
          <span
            className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `clamp(1px, ${row.evenPacePercent}%, calc(100% - 1px))` }}
          />
        ) : null}
      </span>
      {PaceGlyph ? (
        <PaceGlyph
          aria-hidden
          className={cn(
            "size-2.5",
            delta !== null && delta >= ON_PACE_POINTS ? "text-warning" : "text-muted-foreground",
          )}
        />
      ) : null}
    </span>
  );
}

/**
 * Codex weekly, Claude session, and Claude weekly limits as small bars in place of the Usage
 * button. Each tick marks even spending; the arrow says whether you are ahead of or behind it.
 */
export function SidebarUsageBars(props: {
  readonly onOpen: () => void;
  readonly fallback: ReactNode;
}) {
  useLimitsAutoRefresh();
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const rows = sidebarUsageRows(collectLimitPools(collectLimitAccounts(presentations), now), now);
  if (rows.length === 0) return props.fallback;
  const label = `Usage: ${rows.map((row) => `${row.label} ${row.remainingPercent}% left`).join(", ")}`;

  return (
    <SidebarMenuItem className="min-w-0 flex-1">
      <Tooltip>
        <TooltipTrigger
          render={<SidebarMenuButton aria-label={label} onClick={props.onOpen} size="lg" />}
        >
          <span className="flex w-full min-w-0 flex-col gap-1">
            {rows.map((row) => (
              <UsageBarRow key={row.key} row={row} />
            ))}
          </span>
        </TooltipTrigger>
        <TooltipPopup side="top">
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {row.label}: {row.remainingPercent}% left
                  {paceText(row) ? ` · ${paceText(row)}` : ""}
                </span>
                {projectionText(row, now) ? (
                  <span className="text-muted-foreground">{projectionText(row, now)}</span>
                ) : null}
              </div>
            ))}
            <span className="text-muted-foreground">The line is where even spending would be.</span>
          </div>
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
