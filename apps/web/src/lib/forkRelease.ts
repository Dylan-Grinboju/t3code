import type { DesktopForkUpdateState } from "@t3tools/contracts";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/shell";
import { useSyncExternalStore } from "react";

import { requestConfirmDialog } from "../confirmDialog";
import { ensureLocalApi } from "../localApi";
import { readThreadShells } from "../state/entities";
import { readPrimaryEnvironmentId } from "../state/environments";
import { toastManager } from "../components/ui/toast";

// Baked in by the fork's release workflow; empty in every other build, which never checks.
export const FORK_RELEASE_TAG = import.meta.env.VITE_FORK_RELEASE_TAG;
const REPOSITORY = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const KEEP_DOWNLOAD_MS = 24 * 60 * 60 * 1000;

export interface ForkRelease {
  readonly tag: string;
  readonly url: string;
}

export type ForkReleaseStatus =
  | { readonly kind: "unsupported" }
  | { readonly kind: "checking"; readonly latest: ForkRelease | null }
  | { readonly kind: "failed"; readonly latest: ForkRelease | null }
  | { readonly kind: "checked"; readonly latest: ForkRelease };

/** What the release button does next. */
export type ForkUpdateAction =
  | { readonly kind: "check"; readonly busy: boolean }
  | { readonly kind: "open"; readonly release: ForkRelease }
  | { readonly kind: "download"; readonly release: ForkRelease; readonly busy: boolean }
  | { readonly kind: "install"; readonly tag: string; readonly busy: boolean };

interface Snapshot {
  readonly status: ForkReleaseStatus;
  /** Null outside the desktop app, where updates open the release page instead. */
  readonly local: DesktopForkUpdateState | null;
}

const canCheck = Boolean(FORK_RELEASE_TAG && REPOSITORY);
let snapshot: Snapshot = {
  status: canCheck ? { kind: "checking", latest: null } : { kind: "unsupported" },
  local: null,
};
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: { readonly controller: AbortController; readonly done: Promise<boolean> } | null =
  null;

export const isForkReleaseBuild = canCheck;

function forkUpdateBridge() {
  return typeof window === "undefined" ? undefined : window.desktopBridge?.forkUpdate;
}

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function latestOf(current: ForkReleaseStatus) {
  return current.kind === "unsupported" ? null : current.latest;
}

async function fetchLatestRelease(signal: AbortSignal): Promise<ForkRelease> {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const body: unknown = await response.json();
  const { tag_name: tag, html_url: url } = (body ?? {}) as Record<string, unknown>;
  if (typeof tag !== "string" || typeof url !== "string") throw new Error("Unexpected release");
  return { tag, url };
}

function checkForkReleaseNow(): Promise<boolean> {
  if (!canCheck) return Promise.resolve(false);
  if (inFlight) return inFlight.done;
  const controller = new AbortController();
  publish({ status: { kind: "checking", latest: latestOf(snapshot.status) } });
  const done = fetchLatestRelease(controller.signal).then(
    (latest) => {
      inFlight = null;
      publish({ status: { kind: "checked", latest } });
      return true;
    },
    () => {
      inFlight = null;
      if (!controller.signal.aborted)
        publish({ status: { kind: "failed", latest: latestOf(snapshot.status) } });
      return false;
    },
  );
  inFlight = { controller, done };
  return done;
}

export async function checkForkReleaseFromButton() {
  if (await checkForkReleaseNow()) return;
  toastManager.add({
    type: "error",
    title: "Could not check for updates",
    description: "Could not reach GitHub to check for a newer fork release.",
  });
}

function applyLocal(local: DesktopForkUpdateState) {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  // The running build is the download: the install already happened.
  if (local.status === "downloaded" && local.tag === FORK_RELEASE_TAG) {
    void forkUpdateBridge()?.discard().then(applyLocal);
    return;
  }
  if (local.status === "downloaded" && local.downloadedAt !== null) {
    const remaining = local.downloadedAt + KEEP_DOWNLOAD_MS - Date.now();
    expiryTimer = setTimeout(refreshLocal, Math.max(0, remaining) + 1000);
  }
  publish({ local });
}

function refreshLocal() {
  const bridge = forkUpdateBridge();
  if (!canCheck || !bridge) return;
  void bridge.getState().then((local) => {
    applyLocal(local);
    // A download started before a reload is still running in the desktop process.
    if (local.status === "downloading" && local.tag) void downloadForkRelease(local.tag);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (canCheck && timer === null) {
    void checkForkReleaseNow();
    refreshLocal();
    timer = setInterval(checkForkReleaseNow, CHECK_INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || timer === null) return;
    clearInterval(timer);
    timer = null;
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
    inFlight?.controller.abort();
    inFlight = null;
  };
}

/** The fork's latest GitHub release and any downloaded build, checked while anything shows them. */
export function useForkReleaseStatus() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function useForkReleaseChecking() {
  return useSyncExternalStore(subscribe, () => snapshot.status.kind === "checking");
}

function newerForkRelease(current: ForkReleaseStatus): ForkRelease | null {
  const latest = latestOf(current);
  return latest && latest.tag !== FORK_RELEASE_TAG ? latest : null;
}

export function resolveForkUpdateAction(current: Snapshot): ForkUpdateAction | null {
  if (current.status.kind === "unsupported") return null;
  const newer = newerForkRelease(current.status);
  const local = current.local;
  if (local?.status === "installing" && local.tag) {
    return { kind: "install", tag: local.tag, busy: true };
  }
  if (local?.status === "downloading" && local.tag) {
    const release = newer?.tag === local.tag ? newer : { tag: local.tag, url: "" };
    return { kind: "download", release, busy: true };
  }
  // A newer release than the downloaded one replaces it.
  if (local?.status === "downloaded" && local.tag && (!newer || newer.tag === local.tag)) {
    return { kind: "install", tag: local.tag, busy: false };
  }
  if (newer) {
    return local === null || local.status === "unsupported"
      ? { kind: "open", release: newer }
      : { kind: "download", release: newer, busy: false };
  }
  return { kind: "check", busy: current.status.kind === "checking" };
}

async function downloadForkRelease(tag: string) {
  const bridge = forkUpdateBridge();
  if (!bridge) return;
  publish({ local: { status: "downloading", tag, downloadedAt: null, message: null } });
  const local = await bridge.download(REPOSITORY, tag).catch(failedState(tag));
  applyLocal(local);
  if (local.status === "failed") {
    toastManager.add({
      type: "error",
      title: "Update download failed",
      description: local.message,
    });
  }
}

function failedState(tag: string) {
  return (cause: unknown): DesktopForkUpdateState => ({
    status: "failed",
    tag,
    downloadedAt: null,
    message: cause instanceof Error ? cause.message : String(cause),
  });
}

function runningLocalAgentCount() {
  const environmentId = readPrimaryEnvironmentId();
  return readThreadShells().filter(
    (thread) =>
      thread.environmentId === environmentId &&
      thread.archivedAt === null &&
      threadRuntimeIsActive(thread.runtime),
  ).length;
}

async function installForkRelease(tag: string) {
  const bridge = forkUpdateBridge();
  if (!bridge) return;
  const running = runningLocalAgentCount();
  if (running > 0) {
    const message = `${running === 1 ? "An agent is" : `${running} agents are`} still running. Installing ${tag} restarts T3 Code and stops ${running === 1 ? "it" : "them"}. Install anyway?`;
    const confirmed = await (requestConfirmDialog(message, { variant: "destructive" }) ??
      Promise.resolve(window.confirm(message)));
    if (!confirmed) return;
  }
  publish({ local: { status: "installing", tag, downloadedAt: null, message: null } });
  const local = await bridge.install(tag).catch(failedState(tag));
  applyLocal(local);
  if (local.status === "failed") {
    toastManager.add({ type: "error", title: "Update install failed", description: local.message });
  }
}

export function runForkUpdateAction(action: ForkUpdateAction) {
  if ("busy" in action && action.busy) return;
  if (action.kind === "check") return void checkForkReleaseNow();
  if (action.kind === "open") return void ensureLocalApi().shell.openExternal(action.release.url);
  if (action.kind === "download") return void downloadForkRelease(action.release.tag);
  return void installForkRelease(action.tag);
}

export function forkUpdateActionLabel(action: ForkUpdateAction): string {
  switch (action.kind) {
    case "check":
      return action.busy ? "Checking…" : "Check now";
    case "open":
      return `Download ${action.release.tag}`;
    case "download":
      return action.busy ? `Downloading ${action.release.tag}…` : `Download ${action.release.tag}`;
    case "install":
      return action.busy ? "Restarting…" : `Install ${action.tag}`;
  }
}
