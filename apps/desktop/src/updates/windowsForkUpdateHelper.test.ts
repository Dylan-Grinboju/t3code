// @effect-diagnostics-next-line nodeBuiltinImport:off -- Exercise native Windows parent-exit behavior without scoped process cleanup.
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const execFile = NodeUtil.promisify(NodeChildProcess.execFile);

// oxlint-disable-next-line t3code/no-global-process-runtime -- Test collection requires the real host for the Windows-only launcher.
describe.runIf(process.platform === "win32")("launchWindowsForkUpdateHelper", () => {
  it.live("runs the PowerShell helper after its parent exits", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const marker = path.join(yield* fs.makeTempDirectoryScoped(), "installed.txt");
      const helperUrl = new URL("./windowsForkUpdateHelper.ts", import.meta.url).href;
      const writeMarker = `[IO.File]::WriteAllText('${marker.replaceAll("'", "''")}', 'installed')`;
      const parentScript = `
        import { launchWindowsForkUpdateHelper } from ${JSON.stringify(helperUrl)};
        const script = 'Wait-Process -Id ' + process.pid + ' -ErrorAction SilentlyContinue; ' + ${JSON.stringify(writeMarker)};
        console.log(await launchWindowsForkUpdateHelper(script));
      `;
      const parent = yield* Effect.promise(() =>
        execFile(process.execPath, ["--input-type=module", "-e", parentScript], {
          windowsHide: true,
        }),
      );
      const helperPid = Number(parent.stdout.trim());
      assert.isTrue(Number.isSafeInteger(helperPid) && helperPid > 0);
      yield* Effect.promise(() =>
        execFile(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Wait-Process -Id ${helperPid} -ErrorAction SilentlyContinue; exit 0`,
          ],
          { windowsHide: true },
        ),
      );
      assert.isTrue(yield* fs.exists(marker), "the helper exited without executing its script");
      assert.strictEqual(yield* fs.readFileString(marker), "installed");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
