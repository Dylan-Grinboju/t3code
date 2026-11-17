import {
  isCompactionCommandMessage,
  type OrchestrationV2Run,
  type OrchestrationV2TurnItem,
  type ThreadBot,
} from "@t3tools/contracts";

const TERMINAL_RUN_STATUSES = ["completed", "failed", "cancelled", "interrupted", "rolled_back"];

export function botNeedsFreshContext(
  bot: ThreadBot,
  runs: ReadonlyArray<
    Pick<OrchestrationV2Run, "ordinal" | "status" | "userMessageId" | "delegatedCompletion">
  >,
  turnItems: ReadonlyArray<OrchestrationV2TurnItem>,
  contextBoundary: number,
): boolean {
  if (runs.some((run) => !TERMINAL_RUN_STATUSES.includes(run.status))) return false;
  const interactiveMessageIds = new Set(
    turnItems.flatMap((item) =>
      item.type === "user_message" &&
      item.createdBy === "user" &&
      item.scheduledTaskId === undefined &&
      !isCompactionCommandMessage({ ...item, role: "user" })
        ? [item.messageId]
        : [],
    ),
  );
  return (
    runs.filter(
      (run) =>
        run.ordinal >= contextBoundary &&
        run.status === "completed" &&
        run.delegatedCompletion === undefined &&
        interactiveMessageIds.has(run.userMessageId),
    ).length >= bot.freshAfterTurns
  );
}

export function botTurnContext(bot: ThreadBot | null | undefined): string {
  if (!bot) return "";
  return [
    "This is a persistent bot conversation. Its standing objective is:",
    bot.objective,
    `Read the current skill at ${bot.skillPath} and follow it for this turn.`,
    `Durable work state lives at ${bot.statePath}. Read it before acting. Persist decisions, next actions, outstanding questions and work-thread references before yielding. Do not depend on conversation history: sessions are periodically replaced with fresh context. Never silently replace missing or unreadable state with an empty backlog.`,
    "Keep replies short and outcome-first. Omit routine progress narration. Keep quick work inline. Use native subagents for bounded background work; create or reuse a user-accessible persistent thread only when the work needs ongoing human discussion. Keep the main inbox responsive. Observe changes in sources independently of worker callbacks.",
    "The standing objective does not authorize external writes or new execution. Follow the user's authorization and applicable skills. A completed turn does not mean a work item is done. Do not create schedules unless requested; use the host scheduler, never a polling loop.",
  ].join("\n\n");
}
