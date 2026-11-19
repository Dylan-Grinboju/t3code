import type { JiraPreview, JiraPreviewInput } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as ProcessRunner from "../processRunner.ts";

const named = Schema.Struct({ name: Schema.String });
const decodeIssue = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      self: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        issuetype: named,
        status: Schema.Struct({
          name: Schema.String,
          statusCategory: Schema.Struct({ key: Schema.String }),
        }),
        assignee: Schema.NullOr(Schema.Struct({ displayName: Schema.String })),
        updated: Schema.String,
      }),
    }),
  ),
);

export class JiraIssues extends Context.Service<
  JiraIssues,
  {
    readonly preview: (input: JiraPreviewInput) => Effect.Effect<JiraPreview | null>;
  }
>()("t3/jira/JiraIssues") {}

export const make = Effect.fn("JiraIssues.make")(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;
  const read = Effect.fn("JiraIssues.read")(
    function* (args: string[]) {
      const result = yield* runner.run({
        command: "acli",
        args: ["jira", ...args],
        timeout: "10 seconds",
        maxOutputBytes: 64 * 1024,
      });
      return result.code === 0 ? result.stdout : "";
    },
    Effect.orElseSucceed(() => ""),
  );

  return JiraIssues.of({
    preview: Effect.fn("JiraIssues.preview")(function* ({ key, origin }) {
      const json = yield* read([
        "workitem",
        "view",
        key,
        "--fields",
        "summary,issuetype,status,assignee,updated",
        "--json",
      ]);
      const issue = Option.getOrNull(decodeIssue(json));
      if (!issue) return null;
      const self = URL.parse(issue.self);
      if (!self) return null;
      if (self.origin === "https://api.atlassian.com") {
        const cloudId = /^\/ex\/jira\/([^/]+)\//.exec(self.pathname)?.[1];
        if (!cloudId) return null;
        const account = yield* read(["auth", "status"]);
        const site = /\bSite:\s*(?:https:\/\/)?([^/\s]+)\/?\s*$/im.exec(account)?.[1];
        const activeCloud = /\bCloud ID:\s*(\S+)\s*$/im.exec(account)?.[1];
        if (`https://${site?.toLowerCase()}` !== origin || activeCloud !== cloudId) return null;
      } else if (self.origin !== origin) {
        return null;
      }
      const fields = issue.fields;
      return {
        summary: fields.summary,
        issueType: fields.issuetype.name,
        status: fields.status.name,
        statusCategory: fields.status.statusCategory.key,
        assignee: fields.assignee?.displayName ?? null,
        updatedAt: fields.updated,
      };
    }),
  });
});

export const layer = Layer.effect(JiraIssues, make()).pipe(Layer.provide(ProcessRunner.layer));
