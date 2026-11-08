import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";

import {
  FORK_UPDATE_KEEP_MS,
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
});
