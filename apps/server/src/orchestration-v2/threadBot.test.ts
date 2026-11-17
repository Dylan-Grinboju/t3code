import { describe, expect, it } from "vite-plus/test";
import { botNeedsFreshContext, botTurnContext } from "./threadBot.ts";

const bot = {
  objective: "Organize work",
  skillPath: "/skills/cos/SKILL.md",
  statePath: "/work/cos",
  freshAfterTurns: 2,
};
const completed = (ordinal: number, freshContext = false) => ({
  ordinal,
  freshContext,
  status: "completed" as const,
});

describe("bot context", () => {
  it("rotates only at idle boundaries after the configured completed turns", () => {
    expect(botNeedsFreshContext(bot, [completed(1)])).toBe(false);
    expect(botNeedsFreshContext(bot, [completed(1), completed(2)])).toBe(true);
    expect(
      botNeedsFreshContext(bot, [completed(1), completed(2), { ordinal: 3, status: "waiting" }]),
    ).toBe(false);
    expect(
      botNeedsFreshContext(bot, [completed(1), completed(2), { ordinal: 3, status: "queued" }]),
    ).toBe(false);
    expect(botNeedsFreshContext(bot, [completed(1), completed(2), completed(3, true)])).toBe(false);
    expect(
      botNeedsFreshContext(bot, [completed(1), completed(2), completed(3, true), completed(4)]),
    ).toBe(true);
    expect(botNeedsFreshContext(null, [completed(1), completed(2)])).toBe(false);
  });
  it("reloads the portable skill and work state without extending action authority", () => {
    expect(botTurnContext(bot)).toContain(bot.skillPath);
    expect(botTurnContext(bot)).toContain(bot.statePath);
    expect(botTurnContext(bot)).toContain("does not authorize external writes");
    expect(botTurnContext(null)).toBe("");
  });
});
