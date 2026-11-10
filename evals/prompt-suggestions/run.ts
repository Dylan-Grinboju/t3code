// @effect-diagnostics nodeBuiltinImport:off
import * as NodeUtil from "node:util";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Layer from "effect/Layer";
import * as ServerConfig from "../../apps/server/src/config.ts";
import { ClaudeSettings, CodexSettings, ProviderInstanceId } from "@t3tools/contracts";
import { promptSuggestionContext } from "@t3tools/provider-core/server/forkPromptSuggestion";
import * as ClaudeTextGeneration from "../../apps/server/src/textGeneration/ClaudeTextGeneration.ts";
import * as CodexTextGeneration from "../../apps/server/src/textGeneration/CodexTextGeneration.ts";
import { cases } from "./cases.ts";
import { buildReview, ReviewResults } from "./review.ts";

const { values } = NodeUtil.parseArgs({
  options: {
    out: { type: "string" },
    model: { type: "string" },
    provider: { type: "string", default: "claude" },
    case: { type: "string" },
    samples: { type: "string", default: "3" },
    baseline: { type: "string" },
  },
});
if (!values.out || !values.model)
  throw new Error("Use --model <model> --out <directory> [--provider claude|codex].");
if (values.provider !== "claude" && values.provider !== "codex")
  throw new Error("Provider must be claude or codex.");
const samples = Number(values.samples);
if (!Number.isInteger(samples) || samples < 1 || samples > 5)
  throw new Error("Samples must be 1–5.");
const out = values.out;
const model = values.model;
const encode = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const decodeClaudeSettings = Schema.decodeEffect(ClaudeSettings);
const decodeCodexSettings = Schema.decodeEffect(CodexSettings);
const decodeBaseline = Schema.decodeEffect(Schema.fromJsonString(ReviewResults));
await Effect.runPromise(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const baseline = values.baseline
      ? yield* fs.readFileString(values.baseline).pipe(Effect.flatMap(decodeBaseline))
      : undefined;
    const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "t3-suggestion-eval-" });
    const generator =
      values.provider === "claude"
        ? yield* ClaudeTextGeneration.makeClaudeTextGeneration(yield* decodeClaudeSettings({}))
        : yield* CodexTextGeneration.makeCodexTextGeneration(yield* decodeCodexSettings({}));
    const generate = generator.generatePromptSuggestion;
    if (!generate) return yield* Effect.die("Provider does not support suggestions.");
    const selected = cases.filter(
      (item) => !values.case || values.case.split(",").includes(item.id),
    );
    if (selected.length === 0) return yield* Effect.die("No matching cases.");
    yield* fs.makeDirectory(out, { recursive: true });
    const results = [];
    for (const fixture of selected) {
      for (let sample = 0; sample < samples; sample++) {
        const [duration, result] = yield* generate({
          cwd,
          messages: promptSuggestionContext(fixture.messages),
          modelSelection: {
            instanceId: ProviderInstanceId.make(values.provider),
            model,
            options: values.provider === "codex" ? [{ id: "reasoningEffort", value: "low" }] : [],
          },
        }).pipe(Effect.timed);
        results.push({
          id: fixture.id,
          sample,
          model,
          ...result,
          latencyMs: Duration.toMillis(duration),
          expectedSilence: fixture.silence,
          rubric: fixture.rubric,
          presenceCorrect: (result.suggestion === null) === fixture.silence,
        });
        yield* fs.writeFileString(path.join(out, "results.json"), yield* encode(results));
        yield* Effect.log(
          `${fixture.id} [${sample + 1}]: ${result.suggestion ?? "(no suggestion)"}`,
        );
      }
    }
    const { review, answerKey } = buildReview(results, baseline);
    yield* fs.writeFileString(path.join(out, "review.json"), yield* encode(review));
    yield* fs.writeFileString(path.join(out, "answer-key.json"), yield* encode(answerKey));
    yield* fs.writeFileString(
      path.join(out, "summary.json"),
      yield* encode({
        model,
        samples,
        provider: values.provider,
        cost: "Uses the CLI's configured billing. Token cost is not exposed by this runner.",
        instruction:
          "Score review.json before opening results.json or answer-key.json. Presence alone is not a quality grade.",
      }),
    );
  }).pipe(
    Effect.provide(
      ServerConfig.layerTest(process.cwd(), { prefix: "t3-suggestion-eval-state-" }).pipe(
        Layer.provideMerge(NodeServices.layer),
      ),
    ),
    Effect.scoped,
  ),
);
