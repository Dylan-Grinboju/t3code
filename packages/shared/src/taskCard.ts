import { ModelSelection, ProjectId, TrimmedNonEmptyString } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { parseUrl } from "./url.ts";

export const TASK_CARD_TOOL_NAME = "present_task_card";

const text = (limit: number) => TrimmedNonEmptyString.check(Schema.isMaxLength(limit));
const encoder = new TextEncoder();

export const TaskCard = Schema.Struct({
  title: text(200),
  summary: text(2_000),
  sourceUrl: Schema.optionalKey(
    text(2_048).check(
      Schema.makeFilter(
        (value) => {
          const url = parseUrl(value);
          return url !== null && (url.protocol === "https:" || url.protocol === "http:");
        },
        { expected: "an HTTP or HTTPS URL" },
      ),
    ),
  ),
  question: Schema.optionalKey(text(1_000)),
  action: Schema.optionalKey(
    Schema.Struct({
      instruction: text(3_000),
      projectId: ProjectId.check(Schema.isMaxLength(256)),
      baseRef: Schema.optionalKey(text(256)),
      modelSelection: Schema.optionalKey(Schema.toType(ModelSelection)),
    }),
  ),
}).check(
  Schema.makeFilter((card) => card.question === undefined || card.action === undefined, {
    expected: "a question or a Start action, never both",
  }),
  Schema.makeFilter((card) => encoder.encode(JSON.stringify(card)).byteLength <= 7_000, {
    expected: "a task card within 7,000 UTF-8 bytes",
  }),
);

export type TaskCard = typeof TaskCard.Type;
