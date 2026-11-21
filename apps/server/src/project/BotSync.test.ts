import { assert, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  ThreadId,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Option from "effect/Option";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

import { liveThreadShell } from "../mcp/McpToolAccess.testkit.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as BotSync from "./BotSync.ts";

const threadId = ThreadId.make("bot-a");
const otherBot = ThreadId.make("bot-b");
const cwd = "/bot-project";
const bot = { objective: "Sync", skillPath: "SKILL.md", statePath: "state", freshAfterTurns: 12 };
const configured = { [threadId]: "echo ~/sync-a", [otherBot]: "echo ~/sync-b" };

const runner = (
  spawn: Parameters<typeof ChildProcessSpawner.make>[0],
  commands = configured,
  patch: Partial<OrchestrationV2ThreadShell> = {},
) =>
  BotSync.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(spawn)),
        Layer.mock(ProjectionStore.ProjectionStoreV2)({
          getThreadShell: (id) => Effect.succeed({ ...liveThreadShell(id), bot, ...patch }),
        }),
        Layer.mock(ProjectStore.ProjectStoreV2)({
          getShell: (id) =>
            Effect.succeedSome({
              id,
              title: "Bot project",
              workspaceRoot: cwd,
              defaultModelSelection: null,
              scripts: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            }),
        }),
        Layer.mock(ServerSettings.ServerSettingsService)({
          getSettings: Effect.succeed({ ...DEFAULT_SERVER_SETTINGS, botSyncCommands: commands }),
        }),
      ),
    ),
  );

it.effect(
  "starts each bot’s configured shell command once across concurrent callers and closes jobs on shutdown",
  () =>
    Effect.gen(function* () {
      const started: string[] = [];
      const stopped: string[] = [];
      const finish = yield* Deferred.make<void>();
      const layer = runner((command) =>
        Effect.gen(function* () {
          if (command._tag !== "StandardCommand")
            return yield* Effect.die("Expected a shell command");
          assert.equal(command.options.shell, true);
          assert.equal(command.options.cwd, cwd);
          started.push(command.command);
          yield* Effect.addFinalizer(() => Effect.sync(() => stopped.push(command.command)));
          return ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(1),
            exitCode: Deferred.await(finish).pipe(
              Effect.as(
                ChildProcessSpawner.ExitCode(command.command === configured[threadId] ? 0 : 7),
              ),
            ),
            isRunning: Effect.succeed(true),
            kill: () => Effect.void,
            unref: Effect.succeed(Effect.void),
            stdin: Sink.drain,
            stdout: Stream.empty,
            stderr: Stream.empty,
            all: Stream.empty,
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
          });
        }),
      );
      yield* Effect.gen(function* () {
        const service = yield* BotSync.BotSync;
        const result = yield* Effect.all(
          [
            service.run({ threadId }),
            service.run({ threadId }),
            service.run({ threadId: otherBot }),
          ],
          { concurrency: "unbounded" },
        );
        assert.sameMembers(
          result.map((outcome) => outcome.status),
          ["started", "started", "already-running"],
        );
        assert.sameMembers(started, Object.values(configured));
        assert.deepEqual(stopped, []);
        const state = (id: ThreadId, status: string) =>
          service.subscribe(id).pipe(
            Stream.filter((value) => value.status === status),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
          );
        assert.equal((yield* state(threadId, "running")).status, "running");
        yield* Deferred.succeed(finish, undefined);
        assert.equal((yield* state(threadId, "succeeded")).status, "succeeded");
        assert.equal((yield* state(otherBot, "failed")).status, "failed");
        assert.equal(
          (yield* Stream.runHead(service.subscribe(otherBot))).pipe(Option.getOrThrow).status,
          "failed",
        );
      }).pipe(Effect.provide(layer));
      assert.sameMembers(stopped, started);
    }),
);

it.effect("reports shell startup failures and allows the next attempt", () =>
  Effect.gen(function* () {
    let attempts = 0;
    yield* Effect.gen(function* () {
      const sync = yield* BotSync.BotSync;
      for (let i = 0; i < 2; i++) {
        const error = yield* Effect.flip(sync.run({ threadId }));
        assert.match(error.message, /Could not start/);
      }
    }).pipe(
      Effect.provide(
        runner(() =>
          Effect.gen(function* () {
            attempts++;
            return yield* PlatformError.systemError({
              _tag: "NotFound",
              module: "FileSystem",
              method: "access",
            });
          }),
        ),
      ),
    );
    assert.equal(attempts, 2);
  }),
);

it.effect("rejects unconfigured bots, ordinary threads and workers before spawning", () =>
  Effect.gen(function* () {
    const unexpectedSpawn = () => Effect.die("Unexpected sync command");
    const inherited = yield* BotSync.BotSync.pipe(
      Effect.flatMap((service) =>
        Effect.flip(service.run({ threadId: ThreadId.make("toString") })),
      ),
      Effect.provide(runner(unexpectedSpawn)),
    );
    assert.match(inherited.message, /Set a sync command/);
    const { lineage } = liveThreadShell(threadId);
    for (const layer of [
      runner(unexpectedSpawn, { [otherBot]: "echo other" }),
      runner(unexpectedSpawn, configured, { bot: null }),
      runner(unexpectedSpawn, configured, {
        lineage: { ...lineage, relationshipToParent: "subagent" },
      }),
      runner(unexpectedSpawn, configured, { lineage: { ...lineage, sideChat: true } }),
      runner(unexpectedSpawn, configured, { archivedAt: liveThreadShell(threadId).createdAt }),
    ]) {
      const error = yield* BotSync.BotSync.pipe(
        Effect.flatMap((service) => Effect.flip(service.run({ threadId }))),
        Effect.provide(layer),
      );
      assert.equal(error._tag, "BotRunSyncError");
    }
  }),
);
