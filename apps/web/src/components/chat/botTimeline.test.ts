import { expect, it } from "vite-plus/test";
import { MessageId, ScheduledTaskId } from "@t3tools/contracts";
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
});

it("shows every entry while Find is open so its matches stay reachable", () => {
  const fixture = makeStreamingTimelineFixture("Working...");
  const entries = deriveTimelineEntriesFromVisibleTurnItems({
    visibleTurnItems: fixture.visibleTurnItems,
    optimisticMessages: [],
  });
  const view = { entries, bot: true, activity: false, history: false };
  expect(botTimelineEntries({ ...view, findOpen: true })).toBe(entries);
  expect(botTimelineEntries({ ...view, findOpen: false })).toEqual(quietBotEntries(entries, false));
  expect(botTimelineEntries({ ...view, bot: false, findOpen: false })).toBe(entries);
});
