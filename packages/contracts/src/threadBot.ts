import * as Schema from "effect/Schema";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const ThreadBot = Schema.Struct({
  objective: TrimmedNonEmptyString.check(Schema.isMaxLength(8000)),
  skillPath: TrimmedNonEmptyString.check(Schema.isMaxLength(2048)),
  statePath: TrimmedNonEmptyString.check(Schema.isMaxLength(2048)),
  freshAfterTurns: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
});
export type ThreadBot = typeof ThreadBot.Type;
