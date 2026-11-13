// @effect-diagnostics-next-line nodeBuiltinImport:off -- The installer must outlive this app; scoped ChildProcess kills children on exit.
import * as NodeChildProcess from "node:child_process";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Incremental SHA-256 over a ~200 MB download.
import * as NodeCrypto from "node:crypto";

import type { DesktopForkUpdateState } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

// The fork ships unsigned builds whose version matches upstream's, so electron-updater can
// neither verify nor order them. This downloads the fork's GitHub release asset and swaps it in.

export const FORK_UPDATE_KEEP_MS = 24 * 60 * 60 * 1000;
const MANIFEST = "manifest.json";
// The install helpers append here. It outlives a failed install, so the next launch can say why.
const INSTALL_LOG = "install.log";

const Manifest = Schema.Struct({
  tag: Schema.String,
  file: Schema.String,
  downloadedAt: Schema.Number,
});
type Manifest = typeof Manifest.Type;
const ManifestJson = Schema.fromJsonString(Manifest);
const decodeManifest = Schema.decodeEffect(ManifestJson);
const encodeManifest = Schema.encodeEffect(ManifestJson);

const Release = Schema.Struct({
  assets: Schema.Array(Schema.Struct({ name: Schema.String, browser_download_url: Schema.String })),
});

export interface ForkUpdateHost {
  readonly dir: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly execPath: string;
  readonly pid: number;
}

class ForkUpdateError extends Schema.TaggedError<ForkUpdateError>()("ForkUpdateError", {
  message: Schema.String,
}) {}

let inFlight: { readonly tag: string; readonly done: Deferred.Deferred<void> } | null = null;
let failure: { readonly tag: string; readonly message: string } | null = null;
let installing: string | null = null;

/** The release asset this machine can install, matched by electron-builder's artifact name. */
function forkUpdateAssetSuffix(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === "darwin" && arch === "arm64") return "-arm64.zip";
  if (platform === "win32" && arch === "x64") return "-x64.exe";
  return null;
}

/** `sha256sum ./*` output: `<hex>  ./<name>`. */
export function parseSha256Sums(text: string): ReadonlyMap<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(?:\.\/)?(.+)$/i.exec(line.trim());
    if (match) sums.set(match[2]!, match[1]!.toLowerCase());
  }
  return sums;
}

/** The `/Applications` entry to replace: the running bundle's name, wherever it was launched from. */
export function macApplicationsTarget(execPath: string): string | null {
  const bundle = execPath.split("/").slice(0, -3).join("/");
  return bundle.endsWith(".app") ? `/Applications/${bundle.split("/").at(-1)}` : null;
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function state(
  status: DesktopForkUpdateState["status"],
  fields: Partial<Omit<DesktopForkUpdateState, "status">> = {},
): DesktopForkUpdateState {
  return { status, tag: null, downloadedAt: null, message: null, ...fields };
}

const readManifest = Effect.fn("ForkUpdate.readManifest")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.gen(function* () {
    const manifest = yield* fs
      .readFileString(path.join(dir, MANIFEST))
      .pipe(Effect.flatMap(decodeManifest));
    return (yield* fs.exists(path.join(dir, manifest.file))) ? manifest : null;
  }).pipe(Effect.orElseSucceed((): Manifest | null => null));
});

/** Why the last install left the download in place, read from the helper's log. */
function describeInstallLog(log: string, logPath: string): string {
  const error = /^\S+ error: (.+)$/m.exec(log)?.[1]?.trim();
  const code = /^\S+ installer exit code (-?\d+)\s*$/m.exec(log)?.[1];
  const reason = error
    ? `The install failed (${error}).`
    : code === undefined
      ? "The install did not finish."
      : code === "0"
        ? "The installer finished, but T3 Code did not update."
        : `The installer exited with code ${code}.`;
  return `${reason} Log: ${logPath}`;
}

const readInstallFailure = Effect.fn("ForkUpdate.readInstallFailure")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const logPath = path.join(dir, INSTALL_LOG);
  return yield* fs.readFileString(logPath).pipe(
    Effect.map((log) => describeInstallLog(log, logPath)),
    Effect.orElseSucceed((): string | null => null),
  );
});

const removeDir = (dir: string) =>
  FileSystem.FileSystem.use((fs) => fs.remove(dir, { recursive: true, force: true })).pipe(
    Effect.ignore,
  );

export const getForkUpdateState = Effect.fn("ForkUpdate.getState")(function* (
  host: ForkUpdateHost,
) {
  if (forkUpdateAssetSuffix(host.platform, host.arch) === null) return state("unsupported");
  if (installing !== null) return state("installing", { tag: installing });
  if (inFlight !== null) return state("downloading", { tag: inFlight.tag });
  const manifest = yield* readManifest(host.dir);
  const now = yield* Clock.currentTimeMillis;
  if (manifest !== null && now - manifest.downloadedAt < FORK_UPDATE_KEEP_MS) {
    return state("downloaded", {
      tag: manifest.tag,
      downloadedAt: manifest.downloadedAt,
      message: yield* readInstallFailure(host.dir),
    });
  }
  yield* removeDir(host.dir);
  if (failure !== null) return state("failed", { tag: failure.tag, message: failure.message });
  return state("idle");
});

export const discardForkUpdate = Effect.fn("ForkUpdate.discard")(function* (host: ForkUpdateHost) {
  if (inFlight === null && installing === null) {
    failure = null;
    yield* removeDir(host.dir);
  }
  return yield* getForkUpdateState(host);
});

const downloadRelease = Effect.fn("ForkUpdate.downloadRelease")(function* (
  host: ForkUpdateHost,
  repository: string,
  tag: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.setHeader("User-Agent", "T3-Code-Fork-Updater")),
    HttpClient.followRedirects(5),
    HttpClient.filterStatusOk,
  );
  const suffix = forkUpdateAssetSuffix(host.platform, host.arch);
  if (suffix === null) return yield* new ForkUpdateError({ message: "No fork build here." });

  const release = yield* client
    .execute(
      HttpClientRequest.get(
        `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
      ).pipe(HttpClientRequest.acceptJson),
    )
    .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Release)));
  const asset = release.assets.find((candidate) => candidate.name.endsWith(suffix));
  const sumsAsset = release.assets.find((candidate) => candidate.name === "SHA256SUMS");
  if (!asset || !sumsAsset) {
    return yield* new ForkUpdateError({ message: `Release ${tag} has no ${suffix} build.` });
  }
  const sums = parseSha256Sums(
    yield* client.get(sumsAsset.browser_download_url).pipe(Effect.flatMap((r) => r.text)),
  );
  const expected = sums.get(asset.name);
  if (!expected) {
    return yield* new ForkUpdateError({ message: `SHA256SUMS has no entry for ${asset.name}.` });
  }

  yield* removeDir(host.dir);
  yield* fs.makeDirectory(host.dir, { recursive: true });
  const target = path.join(host.dir, asset.name);
  const partial = `${target}.part`;
  const hash = NodeCrypto.createHash("sha256");
  const response = yield* client.get(asset.browser_download_url);
  yield* response.stream.pipe(
    Stream.tap((chunk) => Effect.sync(() => hash.update(chunk))),
    Stream.run(fs.sink(partial)),
  );
  if (hash.digest("hex") !== expected) {
    yield* removeDir(host.dir);
    return yield* new ForkUpdateError({ message: `Checksum mismatch for ${asset.name}.` });
  }
  yield* fs.rename(partial, target);
  const manifest: Manifest = {
    tag,
    file: asset.name,
    downloadedAt: yield* Clock.currentTimeMillis,
  };
  yield* fs.writeFileString(path.join(host.dir, MANIFEST), yield* encodeManifest(manifest));
});

/** Resolves when the download settles; a second call joins the one in flight. */
export const downloadForkUpdate = Effect.fn("ForkUpdate.download")(function* (
  host: ForkUpdateHost,
  repository: string,
  tag: string,
) {
  let done = inFlight?.done;
  if (done === undefined) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
      return state("failed", { tag, message: "Invalid release repository." });
    }
    failure = null;
    const settled = yield* Deferred.make<void>();
    done = settled;
    inFlight = { tag, done: settled };
    // Detached so a reloaded renderer's dropped IPC call cannot cancel the download.
    yield* downloadRelease(host, repository, tag).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          failure = { tag, message: failureMessage(Cause.squash(cause), "The download failed.") };
        }),
      ),
      Effect.ensuring(
        Effect.suspend(() => {
          inFlight = null;
          return Deferred.succeed(settled, undefined);
        }),
      ),
      Effect.forkDetach,
    );
  }
  yield* Deferred.await(done);
  return yield* getForkUpdateState(host);
});

// Runs detached after the app exits: swap the bundle in /Applications, unquarantine, relaunch.
// A failed swap still relaunches whatever is at the destination and keeps the download.
const MAC_INSTALL_SCRIPT = `
pid="$1"; src="$2"; dest="$3"; work="$4"
exec >>"$work/${INSTALL_LOG}" 2>&1
while kill -0 "$pid" 2>/dev/null; do sleep 0.5; done
staged="$dest.updating"
rm -rf "$staged"
if ditto "$src" "$staged" && rm -rf "$dest" && mv "$staged" "$dest"; then
  xattr -dr com.apple.quarantine "$dest" 2>/dev/null
  rm -rf "$work"
else
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) error: could not replace $dest"
  rm -rf "$staged" "$src"
fi
open "$dest"
`;

function powershellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Waits for every process of this install to exit (the server child shares the exe), then runs
 * the NSIS installer silently and logs its exit code. A silent NSIS abort shows nothing otherwise.
 */
function windowsInstallScript(input: {
  readonly pid: number;
  readonly execPath: string;
  readonly installer: string;
  readonly log: string;
}): string {
  return `
$ErrorActionPreference = 'Stop'
$log = ${powershellQuote(input.log)}
function Write-InstallLog($line) { Add-Content -LiteralPath $log -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $line) }
try {
  Wait-Process -Id ${input.pid} -Timeout 30 -ErrorAction SilentlyContinue
  $exe = ${powershellQuote(input.execPath)}
  for ($i = 0; $i -lt 60; $i++) {
    $left = @(Get-Process | Where-Object { $_.Path -eq $exe })
    if ($left.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($left.Count -gt 0) {
    Write-InstallLog ('stopping processes still running: ' + (($left | ForEach-Object { $_.Id }) -join ', '))
    $left | Stop-Process -Force -ErrorAction SilentlyContinue
  }
  Write-InstallLog 'running installer'
  $installer = Start-Process -FilePath ${powershellQuote(input.installer)} -ArgumentList '--updated','/S','--force-run' -PassThru
  $null = $installer.Handle
  $installer.WaitForExit()
  Write-InstallLog ('installer exit code ' + $installer.ExitCode)
} catch {
  Write-InstallLog ('error: ' + $_)
}
`;
}

function spawnDetached(command: string, args: ReadonlyArray<string>) {
  NodeChildProcess.spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

const extractMacApp = Effect.fn("ForkUpdate.extractMacApp")(function* (
  archive: string,
  destination: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  yield* removeDir(destination);
  const exitCode = yield* Effect.scoped(
    spawner
      .spawn(
        ChildProcess.make("/usr/bin/ditto", ["-x", "-k", archive, destination], {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
        }),
      )
      .pipe(Effect.flatMap((handle) => handle.exitCode)),
  );
  if (exitCode !== 0) {
    return yield* new ForkUpdateError({ message: "Could not unpack the downloaded app." });
  }
  const app = (yield* fs.readDirectory(destination)).find((name) => name.endsWith(".app"));
  if (!app) return yield* new ForkUpdateError({ message: "The download has no app bundle." });
  return app;
});

/**
 * Starts the installer, which waits for this process to exit, and reports `installing`;
 * the caller then quits. The NSIS installer runs silently and relaunches the app.
 */
export const startForkUpdateInstall = Effect.fn("ForkUpdate.install")(function* (
  host: ForkUpdateHost,
  tag: string,
) {
  const path = yield* Path.Path;
  const manifest = yield* readManifest(host.dir);
  if (manifest === null || manifest.tag !== tag || inFlight !== null || installing !== null) {
    return yield* getForkUpdateState(host);
  }
  const file = path.join(host.dir, manifest.file);
  const log = path.join(host.dir, INSTALL_LOG);
  const started = yield* Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startedAt = DateTime.formatIso(yield* DateTime.now);
    yield* fs.writeFileString(log, `${startedAt} installing ${tag} over pid ${host.pid}\n`);
    if (host.platform === "darwin") {
      const dest = macApplicationsTarget(host.execPath);
      if (dest === null) {
        return yield* new ForkUpdateError({ message: "T3 Code is not running from an app." });
      }
      const extracted = path.join(host.dir, "extracted");
      const app = yield* extractMacApp(file, extracted);
      const args = [String(host.pid), path.join(extracted, app), dest, host.dir];
      spawnDetached("/bin/sh", ["-c", MAC_INSTALL_SCRIPT, "t3-fork-update", ...args]);
      return true;
    }
    if (host.platform === "win32") {
      const script = windowsInstallScript({
        pid: host.pid,
        execPath: host.execPath,
        installer: file,
        log,
      });
      spawnDetached("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ]);
      return true;
    }
    return false;
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        failure = {
          tag,
          message: failureMessage(Cause.squash(cause), "Could not start the install."),
        };
        return false;
      }),
    ),
  );
  if (!started) {
    return failure === null
      ? state("unsupported")
      : state("failed", { tag, message: failure.message });
  }
  installing = tag;
  return state("installing", { tag });
});
