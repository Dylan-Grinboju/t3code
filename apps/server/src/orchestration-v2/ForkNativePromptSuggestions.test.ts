import { expect, it } from "@effect/vitest";
import { RunId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import * as Native from "./ForkNativePromptSuggestions.ts";

const turn = { threadId: ThreadId.make("thread"), runId: RunId.make("run") };

it.effect("drops late predictions after a new turn starts and resets repeated attempts", () =>
  Effect.gen(function* () {
    const service = yield* Native.ForkNativePromptSuggestions;
    const tracker = Native.makeClaudeSuggestionTracker(service);
    yield* tracker.start(turn);
    yield* tracker.message({ type: "result", subtype: "success" });
    const next = { ...turn, runId: RunId.make("next") };
    yield* tracker.start(next);
    yield* tracker.message({ type: "prompt_suggestion", suggestion: "stale" });
    expect(yield* service.get(turn)).toBeNull();
    yield* tracker.message({ type: "result", subtype: "success" });
    yield* tracker.message({ type: "prompt_suggestion", suggestion: "run the tests" });
    expect(yield* service.get(next)).toBe("run the tests");
    yield* tracker.start(next);
    yield* tracker.message({ type: "result", subtype: "error_during_execution" });
    yield* tracker.message({ type: "prompt_suggestion", suggestion: "stale again" });
    expect(yield* service.get(next)).toBeNull();
  }).pipe(Effect.provide(Native.layer)),
);

it.effect("returns silence when Claude skips a suggestion without consuming future delivery", () =>
  Effect.gen(function* () {
    const service = yield* Native.ForkNativePromptSuggestions;
    yield* service.begin(turn);
    const waiting = yield* service.get(turn).pipe(Effect.forkChild);
    yield* TestClock.adjust("20 seconds");
    expect(yield* Fiber.join(waiting)).toBeNull();
    yield* service.publish(turn, "Show the example");
    expect(yield* service.get(turn)).toBe("Show the example");
  }).pipe(Effect.provide(Native.layer)),
);

it.effect("evicts old pending requests without leaving their callers waiting", () =>
  Effect.gen(function* () {
    const service = yield* Native.ForkNativePromptSuggestions;
    yield* service.begin(turn);
    const waiting = yield* service.get(turn).pipe(Effect.forkChild);
    for (let index = 0; index < 128; index++) {
      yield* service.begin({ ...turn, runId: RunId.make(`other-${index}`) });
    }
    expect(yield* Fiber.join(waiting)).toBeNull();
    yield* service.publish(turn, "evicted");
    expect(yield* service.get(turn)).toBeNull();
  }).pipe(Effect.provide(Native.layer)),
);
