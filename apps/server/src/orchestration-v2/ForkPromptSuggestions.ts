import * as NativeSuggestions from "./ForkNativePromptSuggestions.ts";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  ForkPromptSuggestionInput,
  ForkPromptSuggestionError,
  resolveProjectProviderInstanceEnabled,
} from "@t3tools/contracts";
import { promptSuggestionContext } from "@t3tools/provider-core/server/forkPromptSuggestion";
import * as ThreadManagement from "./ThreadManagementService.ts";
import * as ProviderInstanceRegistry from "../provider/ProviderInstanceRegistry.ts";
import * as ServerSettings from "../serverSettings.ts";

export class ForkPromptSuggestions extends Context.Service<
  ForkPromptSuggestions,
  {
    readonly generate: (
      input: ForkPromptSuggestionInput,
    ) => Effect.Effect<{ readonly suggestion: string | null }, ForkPromptSuggestionError>;
  }
>()("t3/orchestration-v2/ForkPromptSuggestions") {}

const make = Effect.gen(function* () {
  const native = yield* NativeSuggestions.ForkNativePromptSuggestions;
  const threads = yield* ThreadManagement.ThreadManagementService;
  const fileSystem = yield* FileSystem.FileSystem;
  const providers = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const settings = yield* ServerSettings.ServerSettingsService;
  const decode = Schema.decodeEffect(Schema.fromJsonString(ForkPromptSuggestionInput));
  const encode = Schema.encodeEffect(Schema.fromJsonString(ForkPromptSuggestionInput));
  const empty = { suggestion: null };
  const cache = yield* Cache.make({
    capacity: 128,
    timeToLive: "30 minutes",
    lookup: Effect.fn("ForkPromptSuggestions.lookup")(
      function* (key: string) {
        const input = yield* decode(key);
        const records = yield* threads.getThreadRecords(input.threadId, ["runs", "messages"], {
          runStatuses: [],
          includeLatestRun: true,
          messageRoles: ["user", "assistant"],
        });
        const latest = records.runs.toSorted((a, b) => b.ordinal - a.ordinal)[0];
        if (records.thread.deletedAt || latest?.id !== input.runId || latest.status !== "completed")
          return empty;
        const serverSettings = yield* settings.getSettings;
        if (
          !resolveProjectProviderInstanceEnabled(
            serverSettings,
            records.thread.projectId,
            input.modelSelection.instanceId,
          )
        )
          return empty;
        const provider = yield* providers.getInstance(input.modelSelection.instanceId);
        const generate = provider?.textGeneration.generatePromptSuggestion;
        if (!generate) return empty;
        const messages = records.messages
          .filter(
            (message) =>
              !message.streaming && (message.role === "user" || message.role === "assistant"),
          )
          .map((message) => ({ role: message.role as "user" | "assistant", text: message.text }));
        if (messages.at(-1)?.role !== "assistant") return empty;
        // Predictions need conversation text, not repository instructions or workspace tools.
        return yield* Effect.gen(function* () {
          const cwd = yield* fileSystem.makeTempDirectoryScoped({
            prefix: "t3-prompt-suggestion-",
          });
          return yield* generate({
            cwd,
            messages: promptSuggestionContext(messages),
            modelSelection: input.modelSelection,
          });
        }).pipe(Effect.timeout("30 seconds"), Effect.scoped);
      },
      Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })),
    ),
  });
  return ForkPromptSuggestions.of({
    generate: Effect.fn("ForkPromptSuggestions.generate")(function* (input) {
      const preferences = (yield* settings.getSettings.pipe(
        Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })),
      )).forkPromptSuggestions;
      if (!preferences.enabled) return empty;
      const before = yield* threads
        .getThreadRecords(input.threadId, ["runs"], {
          runStatuses: [],
          includeLatestRun: true,
        })
        .pipe(Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })));
      const run = before.runs.toSorted((a, b) => b.ordinal - a.ordinal)[0];
      if (before.thread.deletedAt || run?.id !== input.runId || run.status !== "completed")
        return empty;
      const mainProvider = yield* providers.getInstance(run.providerInstanceId);
      if (!mainProvider) return empty;
      const useNative = preferences.nativeClaude && mainProvider.driverKind === "claudeAgent";
      const key = yield* encode(input).pipe(
        Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })),
      );
      const result = useNative
        ? { suggestion: yield* native.get(input) }
        : yield* Cache.get(cache, key);
      const records = yield* threads
        .getThreadRecords(input.threadId, ["runs"], {
          runStatuses: [],
          includeLatestRun: true,
        })
        .pipe(Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })));
      const latest = records.runs.toSorted((a, b) => b.ordinal - a.ordinal)[0];
      const current = (yield* settings.getSettings.pipe(
        Effect.mapError((cause) => new ForkPromptSuggestionError({ cause })),
      )).forkPromptSuggestions;
      return current.enabled &&
        current.nativeClaude === preferences.nativeClaude &&
        !records.thread.deletedAt &&
        latest?.id === input.runId &&
        latest.status === "completed"
        ? result
        : empty;
    }),
  });
});

export const layer = Layer.effect(ForkPromptSuggestions, make);
