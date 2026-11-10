import { describe, expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import {
  ProjectId,
  ProviderInstanceId,
  RunId,
  ThreadId,
  type ModelSelection,
} from "@t3tools/contracts";
import type { ProviderInstance } from "@t3tools/provider-core/server/driver";
import type { SuggestionMessage } from "@t3tools/provider-core/server/forkPromptSuggestion";
import * as Native from "./ForkNativePromptSuggestions.ts";
import * as ForkPromptSuggestions from "./ForkPromptSuggestions.ts";
import type { ProjectionRecordField, ProjectionRecords } from "./ProjectionStore.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";
import * as ProviderInstanceRegistry from "../provider/ProviderInstanceRegistry.ts";
import * as ServerSettings from "../serverSettings.ts";

const input = {
  threadId: ThreadId.make("suggestion-thread"),
  runId: RunId.make("run-1"),
  modelSelection: { instanceId: ProviderInstanceId.make("claudeAgent"), model: "haiku" },
};

function harness(
  generation: Effect.Effect<{ suggestion: string | null }> = Effect.succeed({
    suggestion: "run the tests",
  }),
  preferences = { enabled: true, nativeClaude: false },
  driverKind = "claudeAgent",
) {
  let status = "completed";
  let runId = input.runId;
  let enabled = true;
  const calls: Array<{
    cwd: string;
    modelSelection: ModelSelection;
    messages: ReadonlyArray<SuggestionMessage>;
  }> = [];
  const records = <K extends ProjectionRecordField>() =>
    ({
      thread: { id: input.threadId, projectId: ProjectId.make("project"), deletedAt: null },
      runs: [
        { id: runId, ordinal: 1, status, providerInstanceId: input.modelSelection.instanceId },
      ],
      messages: [
        { role: "user", text: "Fix it and run tests", streaming: false },
        { role: "assistant", text: "Fixed. Run tests?", streaming: false },
      ],
    }) as unknown as ProjectionRecords<K>;
  const layer = ForkPromptSuggestions.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(ThreadManagement.ThreadManagementService)({
          getThreadRecords: <K extends ProjectionRecordField>() => Effect.sync(records<K>),
        }),
        FileSystem.layerNoop({
          makeTempDirectoryScoped: () => Effect.succeed("/tmp/prediction"),
        }),
        Layer.mock(ProviderInstanceRegistry.ProviderInstanceRegistry)({
          getInstance: () =>
            Effect.sync(() =>
              enabled
                ? ({
                    driverKind,
                    textGeneration: {
                      generatePromptSuggestion: (request: (typeof calls)[number]) =>
                        Effect.suspend(() => {
                          calls.push(request);
                          return generation;
                        }),
                    },
                  } as unknown as ProviderInstance)
                : undefined,
            ),
        }),
        ServerSettings.layerTest({ forkPromptSuggestions: preferences }),
      ),
    ),
    Layer.provideMerge(Native.layer),
  );
  return {
    layer,
    calls,
    setStatus: (value: string) => {
      status = value;
    },
    nextRun: () => {
      runId = RunId.make("run-2");
    },
    disable: () => {
      enabled = false;
    },
  };
}

describe("ForkPromptSuggestions", () => {
  it.effect(
    "waits for the native event after result without calling the selected predictor",
    () => {
      const test = harness(undefined, { enabled: true, nativeClaude: true });
      return Effect.gen(function* () {
        const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
        const native = yield* Native.ForkNativePromptSuggestions;
        const tracker = Native.makeClaudeSuggestionTracker(native);
        yield* tracker.start(input);
        yield* tracker.message({ type: "result", subtype: "success" });
        const request = yield* service
          .generate({
            ...input,
            modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-6-luna" },
          })
          .pipe(Effect.forkChild);
        yield* tracker.message({
          type: "prompt_suggestion",
          suggestion: "Go ahead with the example.",
        });
        expect(yield* Fiber.join(request)).toEqual({ suggestion: "Go ahead with the example." });
        expect(test.calls).toHaveLength(0);
        expect(yield* service.generate(input)).toEqual({
          suggestion: "Go ahead with the example.",
        });
        test.nextRun();
        expect(yield* service.generate(input)).toEqual({ suggestion: null });
      }).pipe(Effect.provide(test.layer));
    },
  );
  it.effect.each(["codex", "opencode"])(
    "uses the selected predictor for %s even with native mode on",
    (driver) => {
      const test = harness(undefined, { enabled: true, nativeClaude: true }, driver);
      return Effect.gen(function* () {
        const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
        expect(yield* service.generate(input)).toEqual({ suggestion: "run the tests" });
        expect(test.calls).toHaveLength(1);
      }).pipe(Effect.provide(test.layer));
    },
  );
  it.effect.each([false, true])(
    "does not call a custom model when native mode is unavailable or disabled (%s)",
    (enabled) => {
      const test = harness(undefined, { enabled, nativeClaude: true });
      return Effect.gen(function* () {
        const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
        expect(yield* service.generate(input)).toEqual({ suggestion: null });
        expect(test.calls).toHaveLength(0);
      }).pipe(Effect.provide(test.layer));
    },
  );
  it.effect("deduplicates concurrent requests and uses the independently selected model", () => {
    const test = harness();
    return Effect.gen(function* () {
      const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
      const results = yield* Effect.all([service.generate(input), service.generate(input)], {
        concurrency: "unbounded",
      });
      expect(results).toEqual([{ suggestion: "run the tests" }, { suggestion: "run the tests" }]);
      expect(test.calls).toHaveLength(1);
      expect(test.calls[0]?.modelSelection).toEqual(input.modelSelection);
      expect(test.calls[0]?.cwd).toBe("/tmp/prediction");
      expect(test.calls[0]?.messages[0]?.text).toBe("Fix it and run tests");
      yield* service.generate({
        ...input,
        modelSelection: { ...input.modelSelection, model: "another-model" },
      });
      expect(test.calls).toHaveLength(2);
    }).pipe(Effect.provide(test.layer));
  });
  it.effect.each(["running", "failed", "interrupted", "cancelled", "rolled_back"])(
    "does not generate for a %s run",
    (status) => {
      const test = harness();
      test.setStatus(status);
      return Effect.gen(function* () {
        const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
        expect(yield* service.generate(input)).toEqual({ suggestion: null });
        expect(test.calls).toHaveLength(0);
      }).pipe(Effect.provide(test.layer));
    },
  );
  it.effect(
    "discards a response when a newer turn starts during generation, including cached responses",
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const finish = yield* Deferred.make<void>();
        const test = harness(
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(finish)),
            Effect.as({ suggestion: "run the tests" }),
          ),
        );
        yield* Effect.gen(function* () {
          const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
          const fiber = yield* service.generate(input).pipe(Effect.forkChild);
          yield* Deferred.await(started);
          test.nextRun();
          yield* Deferred.succeed(finish, undefined);
          expect(yield* Fiber.join(fiber)).toEqual({ suggestion: null });
          expect(yield* service.generate(input)).toEqual({ suggestion: null });
        }).pipe(Effect.provide(test.layer));
      }),
  );
  it.effect("does not run a missing provider", () => {
    const test = harness();
    test.disable();
    return Effect.gen(function* () {
      const service = yield* ForkPromptSuggestions.ForkPromptSuggestions;
      expect(yield* service.generate(input)).toEqual({ suggestion: null });
      expect(test.calls).toHaveLength(0);
    }).pipe(Effect.provide(test.layer));
  });
});
