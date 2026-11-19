import * as Schema from "effect/Schema";

export const JiraPreviewInput = Schema.Struct({
  origin: Schema.String.check(
    Schema.isMaxLength(512),
    Schema.isPattern(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i),
  ),
  key: Schema.String.check(Schema.isMaxLength(128), Schema.isPattern(/^[A-Z][A-Z0-9_]+-\d+$/)),
});
export type JiraPreviewInput = typeof JiraPreviewInput.Type;

export const JiraPreview = Schema.Struct({
  summary: Schema.String,
  issueType: Schema.String,
  status: Schema.String,
  statusCategory: Schema.String,
  assignee: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
});
export type JiraPreview = typeof JiraPreview.Type;
