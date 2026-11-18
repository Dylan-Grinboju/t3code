import {
  MessageId,
  type OrchestrationV2Run,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { botNeedsFreshContext, botTurnContext } from "./threadBot.ts";

const bot = {
  objective: "Organize work",
  skillPath: "/skills/cos/SKILL.md",
  statePath: "/work/cos",
  freshAfterTurns: 2,
};
const userMessage = (ordinal: number, fields: Record<string, unknown> = {}) =>
  ({
    type: "user_message",
    messageId: `message:${ordinal}`,
    createdBy: "user",
    creationSource: "web",
    text: `turn ${ordinal}`,
    attachments: [],
    ...fields,
  }) as unknown as OrchestrationV2TurnItem;
const run = (ordinal: number, status: OrchestrationV2Run["status"] = "completed") => ({
  ordinal,
  status,
  userMessageId: MessageId.make(`message:${ordinal}`),
});
const items = (count: number) =>
  Array.from({ length: count }, (_, index) => userMessage(index + 1));

describe("bot context", () => {
  it("rotates only at idle boundaries after the configured completed turns", () => {
    expect(botNeedsFreshContext(bot, [run(1)], items(1), 0)).toBe(false);
    expect(botNeedsFreshContext(bot, [run(1), run(2)], items(2), 0)).toBe(true);
    expect(botNeedsFreshContext(bot, [run(1), run(2), run(3, "waiting")], items(3), 0)).toBe(false);
    expect(botNeedsFreshContext(bot, [run(1), run(2), run(3, "queued")], items(3), 0)).toBe(false);
    expect(botNeedsFreshContext(bot, [run(1), run(2), run(3)], items(3), 3)).toBe(false);
    expect(botNeedsFreshContext(bot, [run(1), run(2), run(3), run(4)], items(4), 3)).toBe(true);
  });
  it("starts counting at an interrupted fresh run instead of rotating again", () => {
    expect(
      botNeedsFreshContext(bot, [run(1), run(2), run(3, "interrupted"), run(4)], items(4), 3),
    ).toBe(false);
  });
  it("counts only interactive user turns toward rotation", () => {
    const runs = [run(1), run(2), run(3), run(4)];
    const turnItems = [
      userMessage(1),
      userMessage(2, { text: "/compact", createdBy: "agent", creationSource: "server" }),
      userMessage(3, { createdBy: "agent", creationSource: "server" }),
      userMessage(4, { scheduledTaskId: "scheduled:1" }),
    ];
    expect(botNeedsFreshContext(bot, runs, turnItems, 0)).toBe(false);
    expect(botNeedsFreshContext(bot, [...runs, run(5)], [...turnItems, userMessage(5)], 0)).toBe(
      true,
    );
  });
  it("points at the portable skill and work state without extending action authority", () => {
    expect(botTurnContext(bot)).toContain(bot.skillPath);
    expect(botTurnContext(bot)).toContain(bot.statePath);
    expect(botTurnContext(bot)).toContain("does not authorize external writes");
    expect(botTurnContext(null)).toBe("");
  });
});
