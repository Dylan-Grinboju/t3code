import { expect, it } from "vite-plus/test";
import { ThreadId } from "@t3tools/contracts";
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
  const threads = [reviews, archived, makeThreadFixture(), chief];
  expect(visibleBots(threads)).toEqual([chief, reviews]);
  expect(visibleBots([{ ...chief, bot: null }])).toEqual([]);
});

it("surfaces required user actions before working status", () => {
  const thread = makeThreadFixture({ bot, hasPendingApprovals: true });
  expect(botStatus(thread)).toMatchObject({ needsYou: true, label: "Pending Approval" });
  expect(
    botStatus({ ...thread, hasPendingApprovals: false, hasPendingUserInput: true }),
  ).toMatchObject({ needsYou: true, label: "Awaiting Input" });
  expect(botStatus({ ...thread, hasPendingApprovals: false })).toMatchObject({
    needsYou: false,
    label: "Ready",
  });
});
