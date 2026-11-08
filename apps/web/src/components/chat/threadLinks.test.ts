import type { OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { classifyThreadLink, collectThreadLinks } from "./threadLinks";

describe("thread links", () => {
  it.each([
    [
      "https://github.com/acme/app/pull/12/files#diff-1",
      "pull",
      "acme/app#12",
      "https://github.com/acme/app/pull/12",
    ],
    [
      "https://acme.atlassian.net/browse/LIM-1234**",
      "jira",
      "LIM-1234",
      "https://acme.atlassian.net/browse/LIM-1234",
    ],
    [
      "https://acme.atlassian.net/jira/software/projects/LIM/boards/1?selectedIssue=LIM-9",
      "jira",
      "LIM-9",
      "https://acme.atlassian.net/browse/LIM-9",
    ],
    [
      "https://jira.acme.dev/jira/browse/OPS-3",
      "jira",
      "OPS-3",
      "https://jira.acme.dev/jira/browse/OPS-3",
    ],
  ])("classifies %s", (raw, kind, label, url) => {
    expect(classifyThreadLink(raw)).toEqual({ kind, label, url });
  });

  it.each([
    "https://github.com",
    "https://github.com/acme/app/",
    "https://github.com/acme/app/issues/7",
    "https://github.com/acme/app/commit/abcdef1234567",
    "https://github.com/acme/app/blob/main/src/index.ts",
    "https://example.com/browse/lowercase-1",
    "https://acme.atlassian.net/wiki/x",
  ])("ignores %s", (raw) => {
    expect(classifyThreadLink(raw)).toBeNull();
  });

  it("collects settled message links, newest mention first, without duplicates", () => {
    const row = (item: object) => ({ item }) as OrchestrationV2ProjectedTurnItem;
    const links = collectThreadLinks([
      row({ type: "user_message", text: "Fix https://acme.atlassian.net/browse/LIM-1 please" }),
      row({
        type: "assistant_message",
        streaming: false,
        text: "Opened [the PR](https://github.com/acme/app/pull/3) for LIM-1.",
      }),
      row({ type: "user_message", text: "See https://github.com/acme/app/pull/3/files" }),
      row({
        type: "assistant_message",
        streaming: true,
        text: "https://github.com/acme/app/pull/4",
      }),
    ]);
    expect(links.map((link) => link.label)).toEqual(["acme/app#3", "LIM-1"]);
  });
});
