import { DesktopForkUpdateStateSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as ForkUpdate from "../../updates/ForkUpdate.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

const forkUpdateHost = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  return {
    dir: environment.path.join(environment.stateDir, "fork-update"),
    platform: environment.platform,
    arch: environment.processArch,
    execPath: process.execPath,
    pid: process.pid,
  } satisfies ForkUpdate.ForkUpdateHost;
});

export const getForkUpdateState = makeIpcMethod({
  channel: IpcChannels.FORK_UPDATE_GET_STATE_CHANNEL,
  payload: Schema.Void,
  result: DesktopForkUpdateStateSchema,
  handler: Effect.fn("desktop.ipc.forkUpdate.getState")(function* () {
    const host = yield* forkUpdateHost;
    return yield* ForkUpdate.getForkUpdateState(host);
  }),
});

export const downloadForkUpdate = makeIpcMethod({
  channel: IpcChannels.FORK_UPDATE_DOWNLOAD_CHANNEL,
  payload: Schema.Struct({ repository: Schema.String, tag: Schema.String }),
  result: DesktopForkUpdateStateSchema,
  handler: Effect.fn("desktop.ipc.forkUpdate.download")(function* ({ repository, tag }) {
    const host = yield* forkUpdateHost;
    return yield* ForkUpdate.downloadForkUpdate(host, repository, tag);
  }),
});

export const installForkUpdate = makeIpcMethod({
  channel: IpcChannels.FORK_UPDATE_INSTALL_CHANNEL,
  payload: Schema.String,
  result: DesktopForkUpdateStateSchema,
  handler: Effect.fn("desktop.ipc.forkUpdate.install")(function* (tag) {
    const host = yield* forkUpdateHost;
    const result = yield* ForkUpdate.startForkUpdateInstall(host, tag);
    if (result.status === "installing") {
      // Quit after replying so the renderer sees the state; the helper waits for this pid to exit.
      const app = yield* ElectronApp.ElectronApp;
      yield* app.quit.pipe(Effect.delay("250 millis"), Effect.forkDetach);
    }
    return result;
  }),
});

export const discardForkUpdate = makeIpcMethod({
  channel: IpcChannels.FORK_UPDATE_DISCARD_CHANNEL,
  payload: Schema.Void,
  result: DesktopForkUpdateStateSchema,
  handler: Effect.fn("desktop.ipc.forkUpdate.discard")(function* () {
    const host = yield* forkUpdateHost;
    return yield* ForkUpdate.discardForkUpdate(host);
  }),
});
