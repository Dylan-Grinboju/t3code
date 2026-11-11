import { ProviderInstanceId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { threadTabAttention } from "./threadTabAttention";

type Input = NonNullable<Parameters<typeof threadTabAttention>[0]>;
const runId = RunId.make("run-1");

function thread(overrides: Partial<Input> = {}): Input {
  return {
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
  it("shows a ready reply only after work finishes, and clears it when work resumes", () => {
    expect(threadTabAttention(null)).toBeNull();
    expect(threadTabAttention(thread())).toBeNull();
    expect(threadTabAttention(thread({ runtime: runtime("idle") }))).toBeNull();
    for (const status of ["queued", "preparing", "starting", "running", "waiting"] as const) {
      expect(threadTabAttention(thread({ runtime: runtime(status) }))).toBeNull();
      expect(threadTabAttention({ ...completedThread(), runtime: runtime(status) })).toBeNull();
    }
    expect(threadTabAttention(completedThread())).toBe("reply ready");
    expect(threadTabAttention({ ...completedThread(), runtime: runtime("idle") })).toBe(
      "reply ready",
    );
    expect(threadTabAttention({ ...completedThread(), runtime: null })).toBe("reply ready");
    expect(
      threadTabAttention({
        ...completedThread(),
        runtime: { ...runtime("idle"), activeRunId: runId },
      }),
    ).toBeNull();
    for (const status of ["failed", "interrupted", "cancelled", "rolled_back"] as const) {
      const shell = completedThread();
      expect(
        threadTabAttention({ ...shell, latestRun: { ...shell.latestRun!, status } }),
      ).toBeNull();
      expect(threadTabAttention({ ...shell, runtime: runtime(status) })).toBeNull();
    }
    for (const kind of ["subagent", "background_task", "command", "monitor"] as const) {
      const shell = { ...completedThread(), runtime: runtime("idle") };
      const task = { taskId: "task-1", kind };
      expect(threadTabAttention({ ...shell, pendingBackgroundTasks: [task] })).toBe(
        kind === "command" || kind === "monitor" ? "reply ready" : null,
      );
      expect(
        threadTabAttention({ ...shell, pendingBackgroundTasks: [{ ...task, awaited: true }] }),
      ).toBeNull();
    }
  });

  it("shows direct and delegated requests until they are answered, even during a run", () => {
    const shell = thread({ runtime: runtime("running") });
    expect(threadTabAttention({ ...shell, hasPendingApprovals: true })).toBe("needs approval");
    expect(threadTabAttention({ ...shell, hasPendingUserInput: true })).toBe("needs input");
    expect(threadTabAttention({ ...shell, pendingSubagentRequest: "approval" })).toBe(
      "needs approval",
    );
    expect(threadTabAttention({ ...shell, pendingSubagentRequest: "user_input" })).toBe(
      "needs input",
    );
    expect(threadTabAttention(shell)).toBeNull();
  });
});
