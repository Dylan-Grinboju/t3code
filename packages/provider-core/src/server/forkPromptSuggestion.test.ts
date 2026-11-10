import { describe, expect, it } from "vite-plus/test";
import { normalizePromptSuggestion, promptSuggestionContext } from "./forkPromptSuggestion.ts";

describe("prompt suggestion context and output", () => {
  it("keeps the original request and recent corrections within a bounded context", () => {
    const messages = [
      { role: "user" as const, text: "Research only. Don't implement yet." },
      ...Array.from({ length: 20 }, () => ({
        role: "assistant" as const,
        text: "x".repeat(20_000),
      })),
      { role: "user" as const, text: "Actually just explain the last option." },
    ];
    const result = promptSuggestionContext(messages);
    expect(result[0]).toEqual(messages[0]);
    expect(result.at(-1)).toEqual(messages.at(-1));
    expect(result).toHaveLength(11);
    expect(result.reduce((total, message) => total + message.text.length, 0)).toBeLessThan(34_000);
    const afterLongReply = promptSuggestionContext([
      messages[0]!,
      messages.at(-1)!,
      ...messages.slice(1, -1),
    ]);
    expect(afterLongReply).toContainEqual(messages.at(-1));
  });
  it.each([
    [null, null],
    ["", null],
    ["no suggestion", null],
    ["run\nthe tests", null],
    ["I'll run tests", null],
    ["x".repeat(161), null],
    ["run the tests", "run the tests"],
    ["כן", "כן"],
    ["תריץ את הבדיקות", "תריץ את הבדיקות"],
  ])("normalizes %j without an English-only word whitelist", (value, expected) => {
    expect(normalizePromptSuggestion(value)).toBe(expected);
  });
});
