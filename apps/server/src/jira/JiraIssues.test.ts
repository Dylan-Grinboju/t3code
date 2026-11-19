import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import * as ProcessRunner from "../processRunner.ts";
import * as JiraIssues from "./JiraIssues.ts";

const origin = "https://example.atlassian.net";
const input = { origin, key: "OPS-1" };
const account = "✓ Authenticated\n  Site: example.atlassian.net\n  Cloud ID: current";
const routedIssue = "https://jira-prod-eu-35-as-2.prod.atl-paas.net/rest/api/3/issue/3";
const oauthAccount = "✓ Authenticated\n  Site: example.atlassian.net\n  Authentication Type: oauth";
const fields = {
  summary: "Repair the test environment",
  status: { name: "In review", statusCategory: { key: "indeterminate" } },
  issuetype: { name: "Task" },
  updated: "2026-11-18T16:42:00.000+0000",
  assignee: null,
};
const expected = {
  summary: fields.summary,
  status: "In review",
  statusCategory: "indeterminate",
  issueType: "Task",
  updatedAt: fields.updated,
  assignee: null,
};

it.effect.each([
  [routedIssue, oauthAccount, expected],
  [routedIssue, oauthAccount.replace("example.", "other."), null],
  [routedIssue, "", null],
  [origin + "/rest/api/3/issue/3", account, expected],
  ["https://other.atlassian.net/rest/api/3/issue/3", account, null],
  ["https://api.atlassian.com/ex/jira/current/rest/api/3/issue/3", account, expected],
  ["https://api.atlassian.com/ex/jira/other/rest/api/3/issue/3", account, null],
  [
    "https://api.atlassian.com/ex/jira/current/rest/api/3/issue/3",
    account.replace("example.", "other."),
    null,
  ],
] as const)("resolves only issues from the linked site (%s, %s)", ([self, auth, result]) =>
  Effect.gen(function* () {
    const service = yield* JiraIssues.make().pipe(
      Effect.provideService(ProcessRunner.ProcessRunner, {
        run: ({ args }) =>
          Effect.succeed({
            stdout: args[1] === "auth" ? auth : JSON.stringify({ self, fields }),
            stderr: "",
            code: ChildProcessSpawner.ExitCode(0),
            timedOut: false,
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutInvalidUtf8: false,
            stderrInvalidUtf8: false,
          }),
      }),
    );
    expect(yield* service.preview(input)).toEqual(result);
  }),
);
