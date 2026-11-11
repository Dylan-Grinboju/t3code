import { ProviderInstanceId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { threadTabAttention } from "./threadTabAttention";

type Input = NonNullable<Parameters<typeof threadTabAttention>[0]>;
const runId = RunId.make("run-1");

function thread(overrides: Partial<Input> = {}): Input {
  return {
    hasActionableProposedPlan: false,
    interactionMode: "default",
    lastVisitedAt: "2026-11-11T12:00:00Z",
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingSubagentRequest: null,
    runtime: null,
    latestRun: null,
    pendingBackgroundTasks: [],
    ...overrides,
  };
}

function runtime(status: NonNullable<Input["runtime"]>["status"]): NonNullable<Input["runtime"]> {
  return {
    status,
    activeRunId: status === "completed" || status === "idle" ? null : runId,
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerName: null,
    lastError: null,
    updatedAt: "2026-11-11T12:00:00Z",
  };
}

function completedThread(): Input {
  return thread({
    runtime: runtime("completed"),
    latestRun: {
      runId,
      status: "completed",
      requestedAt: "2026-11-11T12:00:00Z",
      startedAt: "2026-11-11T12:00:00Z",
      completedAt: "2026-11-11T12:01:00Z",
      assistantMessageId: null,
    },
  });
}

describe("thread tab attention", () => {
  it("clears a viewed completion, respects mark-unread, and shows work resuming", () => {
    expect(threadTabAttention(null)).toBeNull();
    expect(threadTabAttention(thread())).toBeNull();
    const completed = completedThread();
    expect(threadTabAttention(completed)?.label).toBe("Completed");
    const visitedAt = "2026-11-11T12:02:00Z";
    expect(threadTabAttention({ ...completed, lastVisitedAt: visitedAt })).toBeNull();
    // A server rewind must win over a newer local visit when marking the chat unread.
    expect(threadTabAttention(completed, visitedAt)?.label).toBe("Completed");
    expect(threadTabAttention({ ...completed, lastVisitedAt: undefined }, visitedAt)).toBeNull();
    expect(threadTabAttention({ ...completed, runtime: runtime("running") })?.label).toBe(
      "Working",
    );
    expect(threadTabAttention({ ...completed, runtime: runtime("queued") })?.label).toBe(
      "Connecting",
    );
    expect(
      threadTabAttention({ ...completed, runtime: runtime("running"), blockedOnThreadWait: true })
        ?.label,
    ).toBe("Waiting");
  });

  it("keeps direct and delegated requests visible after the chat is viewed", () => {
    const shell = thread({ runtime: runtime("running"), lastVisitedAt: "2026-11-11T12:02:00Z" });
    expect(threadTabAttention({ ...shell, hasPendingApprovals: true })?.label).toBe(
      "Pending Approval",
    );
    expect(threadTabAttention({ ...shell, hasPendingUserInput: true })?.label).toBe(
      "Awaiting Input",
    );
    expect(threadTabAttention({ ...shell, pendingSubagentRequest: "approval" })?.label).toBe(
      "Pending Approval",
    );
    expect(threadTabAttention({ ...shell, pendingSubagentRequest: "user_input" })?.label).toBe(
      "Awaiting Input",
    );
    expect(threadTabAttention(shell)?.label).toBe("Working");
  });
});
