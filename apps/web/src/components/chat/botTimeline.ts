import type { TimelineEntry } from "../../session-logic";

const attentionTypes = new Set([
  "approval_request",
  "user_input_request",
  "secret_request",
  "link_request",
  "error",
  "thread_created",
]);

export function quietBotEntries(
  entries: ReadonlyArray<TimelineEntry>,
  showHistory: boolean,
): ReadonlyArray<TimelineEntry> {
  const visible = entries.filter((entry) => {
    if (entry.kind === "message") {
      if (entry.message.role === "user")
        return !entry.message.scheduledTaskId && !entry.message.idleCompaction;
      const item = entry.projectedItem?.item;
      return item?.type === "assistant_message"
        ? item.phase === "final_answer" || item.phase == null
        : entry.message.role === "assistant";
    }
    if (entry.kind === "event") return attentionTypes.has(entry.projectedItem.item.type);
    if (entry.kind === "work") {
      const { itemType, tone } = entry.entry;
      return itemType !== "subagent" && (tone === "error" || attentionTypes.has(itemType ?? ""));
    }
    return entry.kind !== "mcp-app";
  });
  if (showHistory || visible.length <= 30) return visible;
  const recent = new Set(visible.slice(-30).map((entry) => entry.id));
  return visible.filter(
    (entry) =>
      recent.has(entry.id) ||
      entry.kind === "event" ||
      entry.kind === "work" ||
      entry.kind === "proposed-plan",
  );
}

export function botTimelineEntries(input: {
  entries: ReadonlyArray<TimelineEntry>;
  bot: boolean;
  activity: boolean;
  history: boolean;
  findOpen: boolean;
  citationActive: boolean;
}): ReadonlyArray<TimelineEntry> {
  if (!input.bot || input.activity || input.findOpen || input.citationActive) return input.entries;
  return quietBotEntries(input.entries, input.history);
}
