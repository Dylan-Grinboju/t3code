import * as Schema from "effect/Schema";
import { ThreadId, RunId } from "./baseSchemas.ts";
import { ModelSelection } from "./modelSelection.ts";

export const ForkPromptSuggestionSettings = Schema.Struct({
  enabled: Schema.Boolean,
  nativeClaude: Schema.Boolean,
});

export const ForkPromptSuggestionSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  nativeClaude: Schema.optionalKey(Schema.Boolean),
});

export const ForkPromptSuggestionInput = Schema.Struct({
  threadId: ThreadId,
  runId: RunId,
  modelSelection: ModelSelection,
});
export type ForkPromptSuggestionInput = typeof ForkPromptSuggestionInput.Type;

export const ForkPromptSuggestionResult = Schema.Struct({
  suggestion: Schema.NullOr(Schema.String),
});

export class ForkPromptSuggestionError extends Schema.TaggedError<ForkPromptSuggestionError>()(
  "ForkPromptSuggestionError",
  { cause: Schema.Defect() },
) {
  override get message() {
    return "Could not generate a prompt suggestion.";
  }
}
