import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell, ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { ThreadId } from "@t3tools/contracts";
import { resolveThreadStatusPill } from "../Sidebar.logic";

export function visibleBots(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  hiddenKeys: ReadonlySet<string>,
) {
  return threads
    .filter(
      (thread) =>
        thread.bot != null &&
        thread.archivedAt === null &&
        thread.deletedAt === null &&
        !hiddenKeys.has(
          scopedThreadKey({ environmentId: thread.environmentId, threadId: thread.id }),
        ),
    )
    .toSorted(
      (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
    );
}

export function botStatus(thread: EnvironmentThreadShell) {
  const status = resolveThreadStatusPill({ thread });
  return {
    label: status?.label === "Completed" ? "New update" : (status?.label ?? "Ready"),
    colorClass: status?.colorClass ?? "text-muted-foreground",
    needsYou:
      status?.label === "Pending Approval" ||
      status?.label === "Awaiting Input" ||
      status?.label === "Guest Request" ||
      status?.label === "Plan Ready",
  };
}

export function botCreatedConversations(projection: Pick<ThreadStructure, "turnItems"> | null) {
  const conversations = new Map<ThreadId, string>();
  for (const item of projection?.turnItems ?? []) {
    if (item.type === "thread_created")
      conversations.set(item.targetThreadId, item.title ?? "Work conversation");
  }
  return [...conversations].map(([threadId, title]) => ({ threadId, title }));
}
