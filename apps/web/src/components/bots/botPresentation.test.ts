import { expect, it } from "vite-plus/test";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { makeThreadFixture } from "../../test-fixtures";
import { botStatus, visibleBots } from "./botPresentation";

const bot = {
  objective: "Organize work",
  skillPath: "~/skills/chief-of-staff/SKILL.md",
  statePath: "~/work.sqlite",
  freshAfterTurns: 12,
};

it("keeps bots visible across task states, excludes archived bots, and orders by identity", () => {
  const chief = makeThreadFixture({
    id: ThreadId.make("chief"),
    title: "Chief of Staff",
    bot,
    settledOverride: "settled",
  });
  const reviews = makeThreadFixture({
    id: ThreadId.make("reviews"),
    title: "Reviews",
    bot,
    snoozedUntil: "2099-01-01T00:00:00Z",
  });
  const archived = makeThreadFixture({
    id: ThreadId.make("archived"),
    bot,
    archivedAt: "2026-01-01T00:00:00Z",
  });
  const worker = makeThreadFixture({
    id: ThreadId.make("worker"),
    bot,
    lineage: { parentThreadId: chief.id, rootThreadId: chief.id, relationshipToParent: "subagent" },
  });
  const remoteWorker = makeThreadFixture({
    id: ThreadId.make("remote-worker"),
    bot,
    delegatedFrom: {
      environmentId: EnvironmentId.make("remote"),
      threadId: chief.id,
      title: chief.title,
    },
  });
  const sideChat = {
    ...worker,
    id: ThreadId.make("side-chat"),
    lineage: { ...worker.lineage, relationshipToParent: "fork" as const, sideChat: true },
  };
  const threads = [reviews, archived, makeThreadFixture(), chief, worker, remoteWorker, sideChat];
  expect(visibleBots(threads)).toEqual([chief, reviews]);
  expect(visibleBots([{ ...chief, bot: null }])).toEqual([]);
});

it("surfaces required user actions before working status", () => {
  const thread = makeThreadFixture({
    bot,
    hasPendingApprovals: true,
    pendingBackgroundTasks: [{ taskId: "worker", kind: "subagent" }],
  });
  expect(botStatus(thread)).toMatchObject({ needsYou: true, label: "Pending Approval" });
  expect(
    botStatus({ ...thread, hasPendingApprovals: false, hasPendingUserInput: true }),
  ).toMatchObject({ needsYou: true, label: "Awaiting Input" });
  expect(botStatus({ ...thread, hasPendingApprovals: false })).toMatchObject({
    needsYou: false,
    label: "Ready",
  });
  expect(
    botStatus({
      ...thread,
      hasPendingApprovals: false,
      pendingBackgroundTasks: [{ taskId: "watch", kind: "monitor", awaited: true }],
    }),
  ).toMatchObject({ needsYou: false, label: "Waiting" });
  expect(
    botStatus({
      ...thread,
      hasPendingApprovals: false,
      blockedOnThreadWait: true,
      runtime: { ...thread.runtime!, status: "running" },
    }),
  ).toMatchObject({ needsYou: false, label: "Waiting" });
});
