import {
  EnvironmentId,
  ThreadId,
  type OrchestrationV2ServerCommand,
  type OrchestrationV2ThreadShell,
  type ThreadBot,
} from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import type { McpInvocationScope } from "./McpInvocationContext.ts";
import * as ThreadMetadataMcpService from "./ThreadMetadataMcpService.ts";

const threadId = ThreadId.make("thread:front-desk");
const scope: McpInvocationScope = {
  environmentId: EnvironmentId.make("environment:box"),
  requestNamespace: "client:test",
  thread: undefined,
  client: undefined,
  capabilities: new Set(["orchestration"]),
  issuedAt: 0,
};
const settings = {
  objective: "Report the status of my work",
  skillPath: "~/skills/front-desk/SKILL.md",
  statePath: "~/work.sqlite",
};

function harness(relationshipToParent: "subagent" | null, currentBot: ThreadBot | null = null) {
  const commands: Array<OrchestrationV2ServerCommand> = [];
  const shell = (bot: ThreadBot | null) =>
    ({
      id: threadId,
      title: "Front desk",
      deletedAt: null,
      bot,
      updatedAt: DateTime.makeUnsafe(0),
      lineage: {
        parentThreadId: relationshipToParent === null ? null : ThreadId.make("thread:parent"),
        relationshipToParent,
        rootThreadId: threadId,
      },
    }) as unknown as OrchestrationV2ThreadShell;
  const layer = ThreadMetadataMcpService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(SecureRandom.SecureRandom)({}),
        Layer.mock(ThreadManagementService.ThreadManagementService)({
          getThreadShell: () => {
            const last = commands.at(-1);
            return Effect.succeed(
              shell(
                last?.type === "thread.metadata.update" && last.bot !== undefined
                  ? last.bot
                  : currentBot,
              ),
            );
          },
          dispatch: (command) =>
            Effect.sync(() => {
              commands.push(command);
              return { sequence: 7, storedEvents: [] } as never;
            }),
        }),
      ),
    ),
  );
  const update = (
    input: Parameters<ThreadMetadataMcpService.ThreadMetadataMcpService["Service"]["update"]>[1],
  ) =>
    ThreadMetadataMcpService.ThreadMetadataMcpService.pipe(
      Effect.flatMap((service) => service.update(scope, { clientRequestId: "request", ...input })),
      Effect.provide(layer),
    );
  return { commands, update };
}

it.effect("makes a top-level thread a bot and returns it to a normal thread", () =>
  Effect.gen(function* () {
    const { commands, update } = harness(null, {
      ...settings,
      freshAfterTurns: 3,
      iconColor: "green",
      glyph: "rocket",
    });
    const made = yield* update({ threadId, action: "set_bot", bot: settings });
    assert.deepEqual(made.bot, {
      ...settings,
      freshAfterTurns: 0,
      iconColor: "green",
      glyph: "rocket",
    });
    const cleared = yield* update({ threadId, action: "clear_bot" });
    assert.equal(cleared.bot, null);
    assert.deepEqual(
      commands.map((command) =>
        command.type === "thread.metadata.update" ? command.bot : "other",
      ),
      [made.bot, null],
    );
  }),
);

it.effect("refuses to make a worker a bot", () =>
  Effect.gen(function* () {
    const { commands, update } = harness("subagent");
    const failure = yield* Effect.flip(update({ threadId, action: "set_bot", bot: settings }));
    assert.equal(failure.code, "invalid_request");
    assert.equal(commands.length, 0);
  }),
);
