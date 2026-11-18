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
    `Its skill is at ${bot.skillPath}. If you have not read it since this session's context began, read it now. Otherwise follow the copy already in your context and do not read it again.`,
    `Its durable work state is at ${bot.statePath}. Access it the way the skill describes, and only as far as this turn needs. Sessions are periodically replaced with fresh context, so keep anything that must outlast this conversation there. Never silently replace missing or unreadable state with empty state.`,
    "The standing objective does not authorize external writes or new execution. Follow the user's authorization and applicable permission rules.",
  ].join("\n\n");
}
