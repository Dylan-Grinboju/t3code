import {
  ProviderDriverKind,
  type ServerProvider,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import {
  displayLimitWindows,
  elapsedShare,
  type LimitPool,
  type LimitPoolWindow,
  paceRemainingPercent,
} from "@t3tools/shared/usageLimits";

const SIDEBAR_USAGE_WINDOWS = [
  { driver: ProviderDriverKind.make("codex"), kind: "weekly", label: "Codex weekly" },
  { driver: ProviderDriverKind.make("claudeAgent"), kind: "session", label: "Claude session" },
  { driver: ProviderDriverKind.make("claudeAgent"), kind: "weekly", label: "Claude weekly" },
] as const;

// Too early in a window to read a burn rate from it.
const MIN_ELAPSED_FOR_PROJECTION = 0.02;

export interface UsageProjection {
  /** Used share minus elapsed share: above 0 spends faster than the window refills. */
  readonly paceDelta: number;
  /** Quota left when the window resets, at the current rate. */
  readonly leftAtReset: number;
  /** How long before the reset the quota runs out at the current rate, or null if it lasts. */
  readonly runsOutBeforeResetMs: number | null;
}

export interface SidebarUsageRow {
  readonly key: string;
  readonly driver: ServerProvider["driver"];
  readonly label: string;
  readonly remainingPercent: number;
  /** Where even spending would put the bar, as a share of the window left. */
  readonly evenPacePercent: number | null;
  readonly resetsAt: number | null;
  readonly projection: UsageProjection | null;
}

export function projectUsage(
  window: ServerProviderUsageWindow,
  usedPercent: number,
  now: number,
): UsageProjection | null {
  const elapsed = elapsedShare(window, now);
  const resetsAt = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
  if (elapsed === null || elapsed < MIN_ELAPSED_FOR_PROJECTION || !Number.isFinite(resetsAt)) {
    return null;
  }
  const used = Math.max(0, Math.min(100, usedPercent));
  const paceDelta = Math.round(used - elapsed * 100);
  const projectedUsed = used / elapsed;
  if (projectedUsed <= 100) {
    return { paceDelta, leftAtReset: Math.round(100 - projectedUsed), runsOutBeforeResetMs: null };
  }
  const elapsedMs = elapsed * (window.windowDurationMins ?? 0) * 60_000;
  const msUntilEmpty = ((100 - used) / used) * elapsedMs;
  return {
    paceDelta,
    leftAtReset: 0,
    runsOutBeforeResetMs: Math.max(0, resetsAt - now - msUntilEmpty),
  };
}

function rowOf(
  pool: LimitPoolWindow,
  key: string,
  driver: ServerProvider["driver"],
  label: string,
  now: number,
): SidebarUsageRow {
  // A pooled window shares one clock; any member's window carries it.
  const timing = pool.members[0]?.window;
  const resetsAt = timing?.resetsAt === undefined ? Number.NaN : Date.parse(timing.resetsAt);
  return {
    key,
    driver,
    label,
    remainingPercent: pool.remainingPercent,
    evenPacePercent: timing ? paceRemainingPercent(timing, now) : null,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
    projection: timing ? projectUsage(timing, pool.usedPercent, now) : null,
  };
}

/** Codex weekly, Claude session, and Claude weekly, in that order, for the ones reported. */
export function sidebarUsageRows(
  pools: readonly LimitPool[],
  now: number,
): readonly SidebarUsageRow[] {
  return SIDEBAR_USAGE_WINDOWS.flatMap(({ driver, kind, label }) => {
    const pool = pools.find((candidate) => candidate.driver === driver);
    const window = pool && displayLimitWindows(pool).find((candidate) => candidate.kind === kind);
    return window ? [rowOf(window, `${driver}:${kind}`, driver, label, now)] : [];
  });
}
