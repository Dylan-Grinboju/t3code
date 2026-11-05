// Builds the sidebar edition installer for this machine's platform and publishes it to the
// fork's GitHub releases. Run it on Windows for the .exe and on a Mac for the .dmg; a second
// run of the same commit adds its installer to the release the first run created.
//
//   node scripts/sidebar-release.ts [--wsl-runtime <t3-*-linux-x64.tar.gz>]
// A fork-only maintenance script, kept as plain Node so it stays easy to read and change.
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
/* oxlint-disable t3code/no-global-process-runtime */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

const { values: flags } = NodeUtil.parseArgs({ options: { "wsl-runtime": { type: "string" } } });
const OUTPUT_DIR = "release";

const run = (command: string, args: ReadonlyArray<string>) =>
  NodeChildProcess.execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

const { upstreamTag } = JSON.parse(NodeFS.readFileSync("scripts/sidebar-release.json", "utf8")) as {
  upstreamTag: string;
};
if (!/^v\d+\.\d+\.\d+$/.test(upstreamTag)) throw new Error(`Bad upstreamTag: ${upstreamTag}`);
const version = upstreamTag.slice(1);

const repo = run("git", ["remote", "get-url", "origin"]).match(
  /github\.com[/:](.+?)(\.git)?$/,
)?.[1];
if (!repo) throw new Error("origin is not a GitHub remote.");
if (run("git", ["status", "--porcelain"]) !== "") throw new Error("Commit your changes first.");
const sha = run("git", ["rev-parse", "HEAD"]);
run("git", ["fetch", "--quiet", "origin"]);
if (run("git", ["branch", "--remotes", "--contains", sha]) === "") {
  throw new Error("Push this commit to origin first; the release points at it.");
}

const target =
  process.platform === "win32"
    ? ["--platform", "win", "--target", "nsis", "--arch", "x64"]
    : process.platform === "darwin"
      ? ["--platform", "mac", "--target", "dmg", "--arch", process.arch]
      : null;
if (!target) throw new Error("Releases are built on Windows or macOS.");

// The same public connection settings CI used, unless the shell overrides them.
for (const line of NodeFS.readFileSync(".env.example", "utf8").split(/\r?\n/)) {
  const match = line.match(
    /^(T3CODE_(?:CLERK_PUBLISHABLE_KEY|CLERK_JWT_TEMPLATE|CLERK_CLI_OAUTH_CLIENT_ID|RELAY_URL))=(.*)$/,
  );
  if (match) process.env[match[1]!] ??= match[2];
}
process.env.T3CODE_TELEMETRY_CHANNEL ??= "dev";

NodeFS.rmSync(OUTPUT_DIR, { recursive: true, force: true });
NodeChildProcess.execFileSync(
  process.execPath,
  [
    "scripts/build-desktop-artifact.ts",
    ...target,
    "--build-version",
    version,
    "--output-dir",
    OUTPUT_DIR,
    ...(flags["wsl-runtime"] ? ["--wsl-runtime", flags["wsl-runtime"]] : []),
  ],
  { stdio: "inherit" },
);

for (const name of NodeFS.readdirSync(OUTPUT_DIR)) {
  if (/^latest-win-.+\.yml$/.test(name))
    NodeFS.renameSync(NodePath.join(OUTPUT_DIR, name), NodePath.join(OUTPUT_DIR, "latest.yml"));
}
const assets = NodeFS.readdirSync(OUTPUT_DIR)
  .filter((name) => !name.startsWith("builder-"))
  .map((name) => NodePath.join(OUTPUT_DIR, name))
  .filter((path) => NodeFS.statSync(path).isFile());
if (!assets.some((path) => /\.(exe|dmg)$/.test(path))) throw new Error("No installer was built.");

const prefix = `${upstreamTag}+sidebar.`;
const releases = run("gh", [
  "api",
  `repos/${repo}/releases`,
  "--paginate",
  "--jq",
  ".[] | [.tag_name, .target_commitish] | @tsv",
])
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t") as [string, string])
  .filter(([tag]) => tag.startsWith(prefix));
const existing = releases.find(([, commit]) => commit === sha)?.[0];

if (existing) {
  run("gh", ["release", "upload", existing, ...assets, "--repo", repo, "--clobber"]);
  console.log(`Added ${assets.length} files to ${existing}.`);
} else {
  const revision =
    Math.max(0, ...releases.map(([tag]) => Number(tag.slice(prefix.length)) || 0)) + 1;
  const tag = `${prefix}${revision}`;
  const notes = NodePath.join(NodeOS.tmpdir(), "sidebar-release-notes.md");
  NodeFS.writeFileSync(
    notes,
    `Based on [T3 Code ${upstreamTag}](https://github.com/pingdotgg/t3code/releases/tag/${upstreamTag}), with the sidebar status strip and optional left-edge hover reveal (Settings > Appearance).\n\nInstallers are unsigned. On macOS, update by downloading and replacing the app; chat data is stored separately.\n`,
  );
  run("gh", [
    "release",
    "create",
    tag,
    ...assets,
    "--repo",
    repo,
    "--target",
    sha,
    "--title",
    `T3 Code ${version} — Sidebar edition (${revision})`,
    "--notes-file",
    notes,
    "--latest",
  ]);
  console.log(`Published ${tag} with ${assets.length} files.`);
}
