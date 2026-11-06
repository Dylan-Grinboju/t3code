import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { projectUsage } from "./sidebarUsage";

const HOUR = 60 * 60_000;
const NOW = Date.parse("2026-11-06T12:00:00Z");

function weekly(hoursLeft: number, usedPercent: number): ServerProviderUsageWindow {
  return {
    id: "weekly",
    kind: "weekly",
    label: "Weekly",
    usedPercent,
    windowDurationMins: 7 * 24 * 60,
    resetsAt: new Date(NOW + hoursLeft * HOUR).toISOString(),
  };
}

describe("projectUsage", () => {
  it("reads headroom at reset when spending under pace", () => {
    // Half the week gone, a quarter used: a half left at reset.
    expect(projectUsage(weekly(84, 25), 25, NOW)).toEqual({
      paceDelta: -25,
      leftAtReset: 50,
      runsOutBeforeResetMs: null,
    });
  });

  it("predicts how long before the reset an over-pace window runs out", () => {
    // Half the week gone, three quarters used: empty after another 28h, 56h before reset.
    expect(projectUsage(weekly(84, 75), 75, NOW)).toEqual({
      paceDelta: 25,
      leftAtReset: 0,
      runsOutBeforeResetMs: 56 * HOUR,
    });
  });

  it("does not guess from the first moments of a window or without a reset time", () => {
    expect(projectUsage(weekly(7 * 24 - 1, 10), 10, NOW)).toBeNull();
    expect(projectUsage({ ...weekly(84, 10), resetsAt: undefined }, 10, NOW)).toBeNull();
  });
});
