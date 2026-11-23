import * as Schema from "effect/Schema";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProjectIconColor } from "./project.ts";

export const WaitingReview = Schema.Struct({
  url: TrimmedNonEmptyString.check(
    Schema.isMaxLength(2048),
    Schema.isPattern(/^https?:\/\/[^\s?#]+$/),
  ),
  head: TrimmedNonEmptyString.check(Schema.isPattern(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)),
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
});
export type WaitingReview = typeof WaitingReview.Type;

export const ReviewMarkerChange = Schema.Union([
  Schema.Struct({ action: Schema.Literal("raise"), ...WaitingReview.fields }),
  Schema.Struct({
    action: Schema.Literal("clear"),
    url: WaitingReview.fields.url,
    head: WaitingReview.fields.head,
  }),
]);
export type ReviewMarkerChange = typeof ReviewMarkerChange.Type;

export const BotGlyph = Schema.Literals([
  "lighthouse",
  "inbox",
  "owl",
  "rocket",
  "wrench",
  "compass",
]);

export const ThreadBot = Schema.Struct({
  objective: TrimmedNonEmptyString.check(Schema.isMaxLength(8000)),
  skillPath: TrimmedNonEmptyString.check(Schema.isMaxLength(2048)),
  statePath: TrimmedNonEmptyString.check(Schema.isMaxLength(2048)),
  freshAfterTurns: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  glyph: Schema.optionalKey(BotGlyph),
  iconColor: Schema.optional(ProjectIconColor),
});
export type ThreadBot = typeof ThreadBot.Type;

export const DEFAULT_BOT_FRESH_AFTER_TURNS = 0;

export const BotSyncState = Schema.Struct({
  status: Schema.Literals(["idle", "running", "succeeded", "failed"]),
  changedAt: Schema.Number,
});
export type BotSyncState = typeof BotSyncState.Type;

export const BotRunSyncInput = Schema.Struct({ threadId: ThreadId });
export type BotRunSyncInput = typeof BotRunSyncInput.Type;

export const BotRunSyncResult = Schema.Struct({
  status: Schema.Literals(["started", "already-running"]),
});
export type BotRunSyncResult = typeof BotRunSyncResult.Type;

export class BotRunSyncError extends Schema.TaggedError<BotRunSyncError>()("BotRunSyncError", {
  message: Schema.String,
}) {}
