import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { backgroundWorkHoldsCompletion } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";

type ThreadTabAttentionInput = Pick<
  EnvironmentThreadShell,
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "runtime"
  | "latestRun"
  | "pendingBackgroundTasks"
>;

export function threadTabAttention(shell: ThreadTabAttentionInput | null) {
  if (shell === null) return null;
  if (shell.hasPendingApprovals || shell.pendingSubagentRequest === "approval") {
    return "needs approval";
  }
  if (shell.hasPendingUserInput || shell.pendingSubagentRequest === "user_input") {
    return "needs input";
  }
  if (
    (shell.runtime !== null &&
      shell.runtime.status !== "completed" &&
      shell.runtime.status !== "idle") ||
    backgroundWorkHoldsCompletion(shell.pendingBackgroundTasks)
  ) {
    return null;
  }
  return shell.latestRun?.status === "completed" &&
    shell.runtime?.activeRunId !== shell.latestRun.runId
    ? "reply ready"
    : null;
}
