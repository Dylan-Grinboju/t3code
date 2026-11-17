import type { OrchestrationV2Run, ThreadBot } from "@t3tools/contracts";

export function botNeedsFreshContext(
  bot: ThreadBot | null | undefined,
  runs: ReadonlyArray<Pick<OrchestrationV2Run, "ordinal" | "status" | "freshContext">>,
): boolean {
  if (
    !bot ||
    runs.some(
      (run) =>
        !["completed", "failed", "cancelled", "interrupted", "rolled_back"].includes(run.status),
    )
  )
    return false;
  const boundary = Math.max(
    0,
    ...runs
      .filter((run) => run.freshContext && run.status === "completed")
      .map((run) => run.ordinal),
  );
  return (
    runs.filter((run) => run.ordinal >= boundary && run.status === "completed").length >=
    bot.freshAfterTurns
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
