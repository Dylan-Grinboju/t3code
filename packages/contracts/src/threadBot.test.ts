import { expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import { ThreadBot } from "./threadBot.ts";

const decode = Schema.decodeUnknownSync(ThreadBot);
const encode = Schema.encodeSync(ThreadBot);

it("round-trips optional bot colors while accepting existing bots and rejecting unknown colors", () => {
  const bot = {
    objective: "Review work",
    skillPath: "~/review/SKILL.md",
    statePath: "~/review.sqlite",
    freshAfterTurns: 12,
  };
  expect(decode(bot)).toEqual(bot);
  const colored = { ...bot, iconColor: "purple" };
  expect(decode(encode(decode(colored)))).toEqual(colored);
  expect(() => decode({ ...bot, iconColor: "unknown" })).toThrow();
});
