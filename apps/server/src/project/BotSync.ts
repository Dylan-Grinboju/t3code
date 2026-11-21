import {
  BotRunSyncError,
  type BotRunSyncInput,
  type BotSyncState,
  type BotRunSyncResult,
  isListedThreadLineage,
  type ThreadId,
} from "@t3tools/contracts";
import * as KeyedLock from "@t3tools/shared/KeyedLock";
import { projectScriptRuntimeEnv } from "@t3tools/shared/projectScripts";
import * as Clock from "effect/Clock";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
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
  {
    readonly subscribe: (threadId: ThreadId) => Stream.Stream<BotSyncState>;
    readonly run: (input: BotRunSyncInput) => Effect.Effect<BotRunSyncResult, BotRunSyncError>;
  }
>()("t3/project/BotSync") {}

const make = Effect.gen(function* () {
  const threads = yield* ProjectionStore.ProjectionStoreV2;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const settings = yield* ServerSettings.ServerSettingsService;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const active = yield* FiberMap.make<ThreadId, void>();
  const launches = yield* KeyedLock.make<ThreadId>();

  const states = yield* SubscriptionRef.make<ReadonlyMap<ThreadId, BotSyncState>>(new Map());
  const idle: BotSyncState = { status: "idle", changedAt: 0 };
  const subscribe = (threadId: ThreadId) =>
    SubscriptionRef.changes(states).pipe(
      Stream.map((byThread) => byThread.get(threadId) ?? idle),
      Stream.changes,
    );
  const setStatus = Effect.fn("BotSync.setStatus")(function* (
    threadId: ThreadId,
    status: BotSyncState["status"],
  ) {
    const changedAt = yield* Clock.currentTimeMillis;
    yield* SubscriptionRef.update(states, (previous) =>
      new Map(previous).set(threadId, { status, changedAt }),
    );
  });

  const monitor = Effect.fn("BotSync.monitor")(
    function* (
      threadId: ThreadId,
      script: string,
      cwd: string,
      started: Deferred.Deferred<void, BotRunSyncError>,
    ) {
      yield* setStatus(threadId, "running");
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
      yield* setStatus(threadId, exitCode === 0 ? "succeeded" : "failed");
      if (exitCode !== 0)
        yield* Effect.logWarning("Bot sync command failed", { threadId, exitCode });
    },
    (effect, threadId) => effect.pipe(Effect.onError(() => setStatus(threadId, "failed"))),
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

  return BotSync.of({ run, subscribe });
});

export const layer = Layer.effect(BotSync, make);
