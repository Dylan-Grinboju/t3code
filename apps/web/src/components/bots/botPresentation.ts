import type { EnvironmentThreadShell, ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { isListedThreadLineage, type ThreadId } from "@t3tools/contracts";
import { resolveThreadStatusPill } from "../Sidebar.logic";

export function visibleBots(threads: ReadonlyArray<EnvironmentThreadShell>) {
  return threads
    .filter(
      (thread) =>
        thread.bot != null &&
        thread.delegatedFrom == null &&
        isListedThreadLineage(thread.lineage) &&
        thread.archivedAt === null &&
        thread.deletedAt === null,
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

export const BOT_RELATIONSHIP_LABELS = {
  related: "Related conversations",
  active: "Background workers",
  previous: "Finished workers",
  lineageTitle: "Work details",
  lineageHeadingId: "bot-work-details-heading",
  sideChatsHeadingId: "bot-work-side-chats-heading",
};

export type ThreadRelationshipLabels = typeof BOT_RELATIONSHIP_LABELS;
