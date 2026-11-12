# Dylan's fork

This repo is `Dylan-Grinboju/t3code`, a fork of `pingdotgg/t3code`. Everything in `AGENTS.md` still
applies. This file adds the rules for fork changes and wins where the two disagree.

## Remotes

- `origin` is the fork. Fork work lands on `origin/main`.
- `upstream` is pingdotgg. Never push, open PRs, or comment there unless Dylan asks. Fork features are
  not upstream contributions.

## The flow for a fork change

1. **Branch.** Work on a `t3/<topic>` worktree branch cut from current `origin/main`.
2. **Decide if it changes existing behavior.** If it does, put it behind a toggle (see Toggles).
3. **Build it with a small footprint.** New fork code goes in new files. Edits to upstream files stay
   as small hooks into that code, so upstream merges stay cheap (see Footprint).
4. **List it on the Fork page.** Add or update its entry in `FORK_FEATURES` in
   `apps/web/src/components/settings/ForkSettingsPanel.tsx` (see Fork settings page).
5. **Verify.** Run `vp run check:changed` and focused tests as `AGENTS.md` describes. For a visible
   change, do one pass in a real client with `test-t3-app`.
6. **Commit.** Use a conventional title in plain language, e.g. `feat(web): ...` or `fix(desktop): ...`.
   One change per commit, so it reads as one line in the release notes.
7. **Land.** Rebase on `origin/main` and push to `origin/main` when Dylan asks. No PR unless asked.
8. **Release, if asked.** Follow Releases below, including the release notes.

## Toggles

A breaking change goes behind a toggle, so another fork user can switch back. A change is breaking
when it takes away or replaces something an upstream user relies on:

- an existing action now does something different, such as a plain click or a link that opens
  elsewhere
- an existing keybinding is rebound or removed
- an existing control or view is removed, hidden, or moved
- stored data changes shape, or data goes somewhere new

Additions and tweaks need no toggle: new panels, new indicators, a new shortcut on a free key, a new
modifier-click, or a small behavior improvement such as list navigation that wraps around. Most fork
features are this kind. If a change is borderline, ask Dylan instead of adding a toggle by default.

Rules for each toggle:

- Off restores upstream behavior exactly. Do not leave half the change active.
- Toggles default to off, keeping upstream behavior until a user opts in. Mark the default in the
  control, for example `Upstream (default)`, and give it a reset button that turns it back off.
- Put the control on the Fork settings page, in the section it belongs to, and register it in
  `apps/web/src/components/settings/settingsSearch.ts` with `searchableSetting(...)` so search finds it.
- Store web-only preferences in client storage (`useLocalStorage`, like the usage bar setting). Add a
  field to `ClientSettingsSchema` in `packages/contracts` only when the desktop main process or server
  must read it, like `browserTrustSlackLinks`. Contract edits are the likeliest upstream conflicts.
- Hide or disable a toggle on surfaces where it does nothing, with `SettingsUnavailableGroup`.

## Fork settings page

`Settings > Dylan's fork` (`/settings/fork`) is the user's map of the fork.

- Every user-visible fork feature has one `FORK_FEATURES` entry: a short title and one or two
  sentences on what it does and how to reach it. Update the entry when the feature changes. Remove it
  when the feature is removed or upstream ships its own version.
- Write it for a user, not a developer: name the shortcut or click, not the component.
- If the feature has a toggle, the entry says where the toggle is.

## Footprint

Upstream moves fast, and every line changed in an upstream file can conflict on the next sync.

- Put fork logic in new files (`ForkSettingsPanel.tsx`, `forkRelease.ts`, `ForkUpdate.ts`, and so on)
  and call into them from upstream files with a few lines.
- Do not reformat, rename, or reorder upstream code you are not changing.
- Do not edit `AGENTS.md` beyond the pointer at its top. Fork rules live here.
- Prefer the Fork settings page over upstream user docs in `docs/user/` for explaining fork features.

## Surfaces

Fork releases ship the desktop app (Mac Apple Silicon and Windows x64) and the web app it bundles.
Mobile is not built from the fork. A fork feature needs to work on web and desktop. Say in the commit
or summary if it does nothing on mobile, and make sure it does not break the mobile build or shared
`packages/client-runtime` code.

## Releases

Releases are built by `.github/workflows/sidebar-release.yml`, which runs only on demand.

1. Push the commits to `origin/main` first. The workflow builds the commit it is started from.
   Check that `version` in `apps/desktop/package.json` matches the upstream release `main` is based
   on. The workflow names the tag and the installers from it.
2. Start it with `gh workflow run sidebar-release.yml -R Dylan-Grinboju/t3code --ref main`. It tags
   `v<upstream version>+sidebar.<n>`, builds both installers, and publishes the release as latest.
   Installed fork builds then offer it from the sidebar button and the Fork settings page.
3. When it finishes, write the release notes. Replace the generated body with what changed since the
   previous fork release:

   ```sh
   prev=v0.1.7+sidebar.17   # the previous fork tag
   next=v0.1.7+sidebar.18   # the tag just published
   git log --no-merges --format='- %s' "$prev..$next"
   ```

   Rewrite that list for users: one line per change, grouped as New, Changed, and Fixed, saying what
   they will notice and where any new toggle lives. Mention when the release includes an upstream sync.
   Keep the download and install paragraph at the end. Then set a title that names the main change:

   ```sh
   gh release edit "$next" -R Dylan-Grinboju/t3code \
     --title "T3 Code 0.1.7 — <main change> ($next)" --notes-file notes.md
   ```

Do not delete or retag a published release. Installed apps compare against the latest tag.

## Syncing upstream

Never merge, rebase onto, or cherry-pick from `upstream` on your own. Being behind upstream is
expected. Dylan does upstream merges, and only when upstream publishes a new version. Build fork
changes on `origin/main` as it is.

If Dylan asks for help with one of those merges:

- Merge the upstream release, not `upstream/main` at an arbitrary commit. Do not rebase: fork release
  tags point at commits on `main`.
- Bump the version in the same sync. Upstream tags `vX` before its `chore(release): prepare vX`
  commit, so the merged tree still carries the previous number. Set `version` to `X` in
  `apps/desktop`, `apps/server`, `apps/web`, and `packages/contracts` `package.json`, and commit it
  as `chore(release): align fork package versions with upstream X`.
- Resolve conflicts in favor of upstream's structure, then reapply the fork's small hooks.
- If upstream now ships something a fork feature did, ask Dylan whether to drop the fork version and
  its `FORK_FEATURES` entry.
- Run `vp run check:changed` and the fork's own tests, then do one pass with `test-t3-app` over the
  Fork settings page, the sidebar, and the update button.
- Say in the next release notes which upstream version the release is based on.
