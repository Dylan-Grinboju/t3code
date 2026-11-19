import * as Effect from "effect/Effect";

import * as McpToolAccess from "../../McpToolAccess.ts";
import { MessageToolkit } from "./tools.ts";

const handlers = {
  present_task_card: McpToolAccess.actsAsCaller((taskCard) => Effect.succeed({ taskCard })),
  send_to_user: McpToolAccess.actsAsCaller((input) =>
    Effect.succeed({
      sentMessage: input.message,
      message: "Shown to the user. Don't repeat it.",
    }),
  ),
} satisfies McpToolAccess.Handlers<typeof MessageToolkit.tools>;

export const layer = McpToolAccess.toLayer(MessageToolkit, handlers);
