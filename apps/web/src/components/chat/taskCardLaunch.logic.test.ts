import { ProjectId, ProviderInstanceId, ThreadId, TurnItemId } from "@t3tools/contracts";
import type { TaskCard } from "@t3tools/shared/taskCard";
import { expect, it } from "vite-plus/test";
import { taskCardLaunchInput, taskCardThreadId } from "./taskCardLaunch.logic";

it("retries a card with the same launch and message ids and scopes them to the source item", () => {
  const sourceId = ThreadId.make("front-desk");
  const itemId = TurnItemId.make("review");
  const target = taskCardThreadId(sourceId, itemId);
  expect(taskCardThreadId(ThreadId.make("another-thread"), itemId)).not.toBe(target);
  expect(taskCardThreadId(sourceId, TurnItemId.make("another-card"))).not.toBe(target);
  const source = {
    modelSelection: { instanceId: ProviderInstanceId.make("source"), model: "source-model" },
    runtimeMode: "approval-required",
    interactionMode: "plan",
  } as const;
  const action = {
    instruction: "Fix the review and draft replies.",
    projectId: ProjectId.make("repo"),
  };
  const card: TaskCard = {
    title: "Review",
    summary: "Two comments",
    sourceUrl: "https://example.org/pull/1",
    action,
  };
  const launch = taskCardLaunchInput(target, card, source);
  expect(taskCardLaunchInput(taskCardThreadId(sourceId, itemId), card, source)).toEqual(launch);
  expect(launch).toEqual({
    ...source,
    commandId: target,
    threadId: target,
    title: card.title,
    projectId: action.projectId,
    workspaceStrategy: { type: "root" },
    initialMessage: {
      messageId: target,
      attachments: [],
      text: "Review\n\nhttps://example.org/pull/1\n\nTwo comments\n\nFix the review and draft replies.",
    },
  });
  const modelSelection = { instanceId: ProviderInstanceId.make("other"), model: "other-model" };
  expect(
    taskCardLaunchInput(
      target,
      { ...card, action: { ...action, modelSelection, baseRef: "origin/fix" } },
      source,
    ),
  ).toMatchObject({
    modelSelection,
    runtimeMode: source.runtimeMode,
    interactionMode: source.interactionMode,
    workspaceStrategy: { type: "worktree", baseRef: "origin/fix", startFromOrigin: true },
  });
  expect(
    taskCardLaunchInput(
      target,
      { title: "Decision", summary: "Two options", question: "Which one?" },
      source,
    ),
  ).toBeNull();
});
