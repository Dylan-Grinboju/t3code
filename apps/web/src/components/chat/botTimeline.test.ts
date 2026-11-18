import { expect, it } from "vite-plus/test";
import { MessageId, ScheduledTaskId, ThreadId, TurnItemId } from "@t3tools/contracts";
import { makeStreamingTimelineFixture } from "../../test-fixtures";
import { deriveTimelineEntriesFromVisibleTurnItems, type TimelineEntry } from "../../session-logic";
import { botTimelineEntries, quietBotEntries } from "./botTimeline";

it("hides tool narration and scheduled prompts while showing phase-less replies as they stream", () => {
  const fixture = makeStreamingTimelineFixture("Working...");
  const entries = deriveTimelineEntriesFromVisibleTurnItems({
    visibleTurnItems: fixture.visibleTurnItems,
    optimisticMessages: [],
  });
  const visible = quietBotEntries(entries, false);
  expect(visible.map((entry) => entry.id)).toEqual([
    "history-user",
    "history-assistant",
    "live-user",
    "live-assistant",
  ]);
  expect(visible[1]).toBe(entries.find((entry) => entry.id === "history-assistant"));
  const commentary = deriveTimelineEntriesFromVisibleTurnItems({
    visibleTurnItems: fixture.visibleTurnItems.map((row) =>
      row.item.type === "assistant_message"
        ? { ...row, item: { ...row.item, phase: "commentary" as const } }
        : row,
    ),
    optimisticMessages: [],
  });
  expect(quietBotEntries(commentary, false).map((entry) => entry.id)).toEqual([
    "history-user",
    "live-user",
  ]);
  const user = visible[0];
  if (user?.kind !== "message") throw new Error("Missing user message");
  expect(
    quietBotEntries(
      [{ ...user, message: { ...user.message, scheduledTaskId: ScheduledTaskId.make("check") } }],
      true,
    ),
  ).toEqual([]);
});

it("keeps older attention cards and restores old messages through History without mutation", () => {
  const entries: TimelineEntry[] = Array.from({ length: 40 }, (_, index) => ({
    kind: "message",
    id: String(index),
    createdAt: "2026-01-01T00:00:00Z",
    message: {
      id: MessageId.make(String(index)),
      role: "user",
      text: `Decision ${index}`,
      runId: null,
      streaming: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  }));
  const approval: TimelineEntry = {
    kind: "work",
    id: "approval",
    createdAt: "2026-01-01T00:00:00Z",
    entry: {
      id: "approval",
      createdAt: "2026-01-01T00:00:00Z",
      runId: null,
      label: "Needs approval",
      tone: "info",
      itemType: "approval_request",
    },
  };
  const history = [approval, ...entries];
  expect(quietBotEntries(history, false)).toEqual([approval, ...entries.slice(-30)]);
  expect(quietBotEntries(history, true)).toEqual(history);
  expect(history).toHaveLength(41);
  const view = { entries: history, bot: true, activity: false, history: false, findOpen: false };
  expect(botTimelineEntries({ ...view, citationActive: true })).toBe(history);
  expect(botTimelineEntries({ ...view, citationActive: false })).toEqual([
    approval,
    ...entries.slice(-30),
  ]);
});

it("shows every entry while Find is open so its matches stay reachable", () => {
  const fixture = makeStreamingTimelineFixture("Working...");
  const entries = deriveTimelineEntriesFromVisibleTurnItems({
    visibleTurnItems: fixture.visibleTurnItems,
    optimisticMessages: [],
  });
  const view = { entries, bot: true, activity: false, history: false, citationActive: false };
  expect(botTimelineEntries({ ...view, findOpen: true })).toBe(entries);
  expect(botTimelineEntries({ ...view, findOpen: false })).toEqual(quietBotEntries(entries, false));
  expect(botTimelineEntries({ ...view, bot: false, findOpen: false })).toBe(entries);
});

it("hides integration cards in Quiet and keeps them accessible in Activity and normal threads", () => {
  const createdAt = "2026-01-01T00:00:00Z";
  const card: TimelineEntry = {
    kind: "mcp-app",
    id: "mcp-app:search",
    createdAt,
    runId: null,
    sourceThreadId: ThreadId.make("bot"),
    itemId: TurnItemId.make("search"),
    revision: "1",
    mcpApp: {
      attachmentId: "jira-results.html",
      server: "atlassian",
      tool: "search",
      resourceUri: "ui://atlassian/results",
    },
  };
  const reply: TimelineEntry = {
    kind: "sent-message",
    id: "sent-message:recommendation",
    createdAt,
    runId: null,
    text: "I recommend unblocking the release first.",
  };
  const entries = [card, reply];
  const view = {
    entries,
    bot: true,
    activity: false,
    history: false,
    findOpen: false,
    citationActive: false,
  };
  expect(botTimelineEntries(view)).toEqual([reply]);
  expect(botTimelineEntries({ ...view, history: true })).toEqual([reply]);
  expect(botTimelineEntries({ ...view, activity: true })).toBe(entries);
  expect(botTimelineEntries({ ...view, bot: false })).toBe(entries);
});
