// @effect-diagnostics nodeBuiltinImport:off
import * as NodeCrypto from "node:crypto";
import * as Schema from "effect/Schema";
import { cases } from "./cases.ts";

export const ReviewResults = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    sample: Schema.Number,
    model: Schema.String,
    suggestion: Schema.NullOr(Schema.String),
  }),
);

export function buildReview(
  results: typeof ReviewResults.Type,
  baseline?: typeof ReviewResults.Type,
) {
  const answerKey: Array<{ id: string; sample: number; candidate: "A" | "B" }> = [];
  const review = results.map((result) => {
    const fixture = cases.find((item) => item.id === result.id);
    const previous = baseline?.find(
      (item) => item.id === result.id && item.sample === result.sample,
    );
    if (baseline && (!previous || previous.model !== result.model)) {
      throw new Error(`Baseline must contain the same model and sample for ${result.id}.`);
    }
    const candidateFirst = NodeCrypto.randomInt(2) === 0;
    answerKey.push({ id: result.id, sample: result.sample, candidate: candidateFirst ? "A" : "B" });
    return {
      id: result.id,
      sample: result.sample,
      messages: fixture?.messages,
      rubric: fixture?.rubric,
      ...(previous
        ? {
            A: candidateFirst ? result.suggestion : previous.suggestion,
            B: candidateFirst ? previous.suggestion : result.suggestion,
            preferred: "",
          }
        : { suggestion: result.suggestion }),
      grade: "",
      notes: "",
    };
  });
  return { review, answerKey };
}
