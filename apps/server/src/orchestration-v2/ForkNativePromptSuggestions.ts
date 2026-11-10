import type { RunId, ThreadId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

interface SuggestionTurn {
  readonly threadId: ThreadId;
  readonly runId: RunId;
}

export class ForkNativePromptSuggestions extends Context.Service<
  ForkNativePromptSuggestions,
  {
    readonly begin: (turn: SuggestionTurn) => Effect.Effect<void>;
    readonly publish: (turn: SuggestionTurn, suggestion: string | null) => Effect.Effect<void>;
    readonly get: (turn: SuggestionTurn) => Effect.Effect<string | null>;
  }
>()("t3/orchestration-v2/ForkNativePromptSuggestions") {}

export const layer = Layer.effect(
  ForkNativePromptSuggestions,
  Effect.sync(() => {
    const pending = new Map<string, Deferred.Deferred<string | null>>();
    const key = (turn: SuggestionTurn) => JSON.stringify([turn.threadId, turn.runId]);
    return ForkNativePromptSuggestions.of({
      begin: Effect.fn("ForkNativePromptSuggestions.begin")(function* (turn) {
        const previous = pending.get(key(turn));
        if (previous) {
          yield* Deferred.succeed(previous, null);
          pending.delete(key(turn));
        }
        if (pending.size >= 128) {
          const oldest = pending.entries().next().value;
          if (oldest) {
            yield* Deferred.succeed(oldest[1], null);
            pending.delete(oldest[0]);
          }
        }
        pending.set(key(turn), yield* Deferred.make<string | null>());
      }),
      publish: Effect.fn("ForkNativePromptSuggestions.publish")(function* (turn, suggestion) {
        const entry = pending.get(key(turn));
        if (entry) yield* Deferred.succeed(entry, suggestion?.trim() || null);
      }),
      get: Effect.fn("ForkNativePromptSuggestions.get")(function* (turn) {
        const entry = pending.get(key(turn));
        if (!entry) return null;
        return yield* Deferred.await(entry).pipe(
          Effect.timeoutOption("20 seconds"),
          Effect.map(Option.getOrNull),
        );
      }),
    });
  }),
);

// SDK suggestions follow result and carry a session ID, but no turn ID.
export function makeClaudeSuggestionTracker(service: ForkNativePromptSuggestions["Service"]) {
  let turn: SuggestionTurn | null = null;
  let completed = false;
  return {
    start: Effect.fn("ClaudeSuggestionTracker.start")(function* (next: SuggestionTurn) {
      if (turn) yield* service.publish(turn, null);
      turn = next;
      completed = false;
      yield* service.begin(next);
    }),
    message: Effect.fn("ClaudeSuggestionTracker.message")(function* (message: {
      readonly type: string;
      readonly subtype?: string;
      readonly suggestion?: string;
    }) {
      if (!turn) return;
      if (message.type === "result") {
        completed = message.subtype === "success";
        if (!completed) yield* service.publish(turn, null);
      } else if (message.type === "prompt_suggestion" && completed) {
        yield* service.publish(turn, message.suggestion ?? null);
        completed = false;
      }
    }),
  };
}
