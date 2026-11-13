import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import {
  FORK_UPDATE_KEEP_MS,
  discardForkUpdate,
  downloadForkUpdate,
  getForkUpdateState,
  macApplicationsTarget,
  parseSha256Sums,
} from "./ForkUpdate.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "B".repeat(64);

describe("parseSha256Sums", () => {
  it("reads sha256sum output with ./ prefixes, binary markers and CRLF", () => {
    const sums = parseSha256Sums(
      `${HASH_A}  ./T3-Code-1.0.0-arm64.zip\r\n${HASH_B} *T3-Code-1.0.0-x64.exe\n\nnot a line\n`,
    );
    assert.strictEqual(sums.get("T3-Code-1.0.0-arm64.zip"), HASH_A);
    assert.strictEqual(sums.get("T3-Code-1.0.0-x64.exe"), "b".repeat(64));
    assert.strictEqual(sums.size, 2);
  });
});

describe("downloadForkUpdate", () => {
  it.effect("identifies itself to GitHub and downloads a checksum-verified installer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = path.join(yield* fs.makeTempDirectoryScoped(), "fork-update");
      const host = { dir, platform: "win32", arch: "x64", execPath: "", pid: 1 } as const;
      const base = "https://github.com/owner/repo/releases/download/v1%2Bsidebar.2";
      const name = "T3-Code-1.0.0-x64.exe";
      const client = HttpClient.make((request) => {
        const response =
          request.url === "https://api.github.com/repos/owner/repo/releases/tags/v1%2Bsidebar.2"
            ? request.headers["user-agent"]
              ? Response.json({
                  assets: [
                    { name, browser_download_url: `${base}/${name}` },
                    { name: "SHA256SUMS", browser_download_url: `${base}/SHA256SUMS` },
                  ],
                })
              : new Response("User-Agent required", { status: 403 })
            : request.url === `${base}/SHA256SUMS`
              ? new Response(
                  `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  ./${name}\n`,
                )
              : request.url === `${base}/${name}`
                ? new Response("hello")
                : new Response("Not found", { status: 404 });
        return Effect.succeed(HttpClientResponse.fromWeb(request, response));
      });
      yield* Effect.gen(function* () {
        const result = yield* downloadForkUpdate(host, "owner/repo", "v1+sidebar.2");
        assert.strictEqual(result.status, "downloaded");
        assert.strictEqual(result.tag, "v1+sidebar.2");
        assert.strictEqual(yield* fs.readFileString(path.join(dir, name)), "hello");
        assert.isFalse(yield* fs.exists(path.join(dir, `${name}.part`)));
      }).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.ensuring(discardForkUpdate(host)),
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});

describe("macApplicationsTarget", () => {
  it("targets the running bundle's name in /Applications, wherever it runs from", () => {
    assert.strictEqual(
      macApplicationsTarget("/Users/me/Downloads/T3 Code (Beta).app/Contents/MacOS/T3 Code (Beta)"),
      "/Applications/T3 Code (Beta).app",
    );
    assert.isNull(macApplicationsTarget("/usr/local/bin/electron"));
  });
});

describe("getForkUpdateState", () => {
  it.effect("keeps a download for 24 hours, then deletes it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = path.join(yield* fs.makeTempDirectoryScoped(), "fork-update");
      const host = { dir, platform: "win32", arch: "x64", execPath: "", pid: 1 } as const;
      yield* fs.makeDirectory(dir);
      yield* fs.writeFileString(path.join(dir, "setup.exe"), "");
      yield* fs.writeFileString(
        path.join(dir, "manifest.json"),
        JSON.stringify({ tag: "v1+sidebar.2", file: "setup.exe", downloadedAt: 0 }),
      );

      yield* TestClock.adjust(FORK_UPDATE_KEEP_MS - 1);
      const kept = yield* getForkUpdateState(host);
      assert.strictEqual(kept.status, "downloaded");
      assert.strictEqual(kept.tag, "v1+sidebar.2");

      yield* TestClock.adjust(1);
      assert.strictEqual((yield* getForkUpdateState(host)).status, "idle");
      assert.isFalse(yield* fs.exists(dir));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("explains a failed install from the helper's log", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = path.join(yield* fs.makeTempDirectoryScoped(), "fork-update");
      const host = { dir, platform: "win32", arch: "x64", execPath: "", pid: 1 } as const;
      const log = path.join(dir, "install.log");
      yield* fs.makeDirectory(dir);
      yield* fs.writeFileString(path.join(dir, "setup.exe"), "");
      yield* fs.writeFileString(
        path.join(dir, "manifest.json"),
        JSON.stringify({ tag: "v1+sidebar.2", file: "setup.exe", downloadedAt: 0 }),
      );
      assert.isNull((yield* getForkUpdateState(host)).message);

      const started = "2026-11-12T20:49:45.000Z installing v1+sidebar.2 over pid 1\n";
      // The Windows helper writes with Add-Content, so its lines end in CRLF.
      for (const [helperLines, reason] of [
        ["", "The install did not finish."],
        ["2026-11-12T20:50:01.0Z installer exit code 2\r\n", "The installer exited with code 2."],
        ["2026-11-12T20:50:01.0Z installer exit code 0\r\n", "The installer finished, but"],
        ["2026-11-12T20:50:01.0Z error: Access is denied.\r\n", "The install failed (Access is"],
      ] as const) {
        yield* fs.writeFileString(log, started + helperLines);
        const result = yield* getForkUpdateState(host);
        assert.strictEqual(result.status, "downloaded");
        assert.isTrue(result.message?.startsWith(reason), result.message ?? "no message");
        assert.isTrue(result.message?.endsWith(log), result.message ?? "no message");
      }
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
