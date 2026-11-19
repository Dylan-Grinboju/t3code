import {
  BotRunSyncError,
  type BotRunSyncInput,
  type BotRunSyncResult,
  isListedThreadLineage,
  type ThreadId,
} from "@t3tools/contracts";
import * as KeyedLock from "@t3tools/shared/KeyedLock";
import { projectScriptRuntimeEnv } from "@t3tools/shared/projectScripts";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FiberMap from "effect/FiberMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ServerSettings from "../serverSettings.ts";

export class BotSync extends Context.Service<
  BotSync,
  { readonly run: (input: BotRunSyncInput) => Effect.Effect<BotRunSyncResult, BotRunSyncError> }
>()("t3/project/BotSync") {}

const make = Effect.gen(function* () {
  const threads = yield* ProjectionStore.ProjectionStoreV2;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const settings = yield* ServerSettings.ServerSettingsService;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const active = yield* FiberMap.make<ThreadId, void>();
  const launches = yield* KeyedLock.make<ThreadId>();

  const monitor = Effect.fn("BotSync.monitor")(
    function* (
      threadId: ThreadId,
      script: string,
      cwd: string,
      started: Deferred.Deferred<void, BotRunSyncError>,
    ) {
      const command = ChildProcess.make(script, {
        shell: true,
        cwd,
        env: projectScriptRuntimeEnv({ project: { cwd } }),
        extendEnv: true,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
        forceKillAfter: "3 seconds",
      });
      const child = yield* spawner.spawn(command).pipe(
        Effect.mapError(
          () =>
            new BotRunSyncError({
              message: "Could not start the sync command in the bot’s project.",
            }),
        ),
        Effect.onExit((exit) => Deferred.done(started, Exit.asVoid(exit))),
      );
      const exitCode = yield* child.exitCode;
      if (exitCode !== 0)
        yield* Effect.logWarning("Bot sync command failed", { threadId, exitCode });
    },
    Effect.scoped,
    Effect.ignore({ log: true }),
  );

  const run = Effect.fn("BotSync.run")(function* ({ threadId }: BotRunSyncInput) {
    const thread = yield* threads
      .getThreadShell(threadId)
      .pipe(Effect.mapError(() => new BotRunSyncError({ message: "Could not load the bot." })));
    if (
      !thread?.bot ||
      thread.archivedAt !== null ||
      thread.deletedAt !== null ||
      thread.delegatedFrom != null ||
      !isListedThreadLineage(thread.lineage)
    ) {
      return yield* new BotRunSyncError({ message: "Only an active bot can start a sync." });
    }
    const saved = yield* settings.getSettings.pipe(
      Effect.mapError(() => new BotRunSyncError({ message: "Could not load the sync command." })),
    );
    const script = saved.botSyncCommands[threadId];
    if (typeof script !== "string" || !script.trim()) {
      return yield* new BotRunSyncError({ message: "Set a sync command in this bot’s settings." });
    }
    const project = yield* projects
      .getShell(thread.projectId)
      .pipe(
        Effect.mapError(
          () => new BotRunSyncError({ message: "Could not load the bot’s project." }),
        ),
      );
    if (Option.isNone(project)) {
      return yield* new BotRunSyncError({ message: "The bot’s project no longer exists." });
    }
    const cwd = project.value.workspaceRoot;
    return yield* launches.withLock(
      threadId,
      Effect.gen(function* () {
        if (yield* FiberMap.has(active, threadId)) return { status: "already-running" } as const;
        const started = yield* Deferred.make<void, BotRunSyncError>();
        yield* FiberMap.run(active, threadId, monitor(threadId, script, cwd, started));
        yield* Deferred.await(started);
        return { status: "started" } as const;
      }),
    );
  });

  return BotSync.of({ run });
});

export const layer = Layer.effect(BotSync, make);
