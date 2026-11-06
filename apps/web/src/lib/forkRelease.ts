import { useSyncExternalStore } from "react";

// Baked in by the fork's release workflow; empty in every other build, which never checks.
export const FORK_RELEASE_TAG = import.meta.env.VITE_FORK_RELEASE_TAG;
const REPOSITORY = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface ForkRelease {
  readonly tag: string;
  readonly url: string;
}

export type ForkReleaseStatus =
  | { readonly kind: "unsupported" }
  | { readonly kind: "checking"; readonly latest: ForkRelease | null }
  | { readonly kind: "failed"; readonly latest: ForkRelease | null }
  | { readonly kind: "checked"; readonly latest: ForkRelease };

const canCheck = Boolean(FORK_RELEASE_TAG && REPOSITORY);
let status: ForkReleaseStatus = canCheck
  ? { kind: "checking", latest: null }
  : { kind: "unsupported" };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: AbortController | null = null;

function publish(next: ForkReleaseStatus) {
  status = next;
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

export function checkForkReleaseNow() {
  if (!canCheck || inFlight) return;
  const controller = new AbortController();
  inFlight = controller;
  publish({ kind: "checking", latest: latestOf(status) });
  fetchLatestRelease(controller.signal).then(
    (latest) => {
      inFlight = null;
      publish({ kind: "checked", latest });
    },
    () => {
      inFlight = null;
      if (!controller.signal.aborted) publish({ kind: "failed", latest: latestOf(status) });
    },
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (canCheck && timer === null) {
    checkForkReleaseNow();
    timer = setInterval(checkForkReleaseNow, CHECK_INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || timer === null) return;
    clearInterval(timer);
    timer = null;
    inFlight?.abort();
    inFlight = null;
  };
}

/** The fork's latest GitHub release, checked while anything shows it and every six hours. */
export function useForkReleaseStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

export function newerForkRelease(current: ForkReleaseStatus): ForkRelease | null {
  const latest = latestOf(current);
  return latest && latest.tag !== FORK_RELEASE_TAG ? latest : null;
}
