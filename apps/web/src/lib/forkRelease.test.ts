import type { DesktopForkUpdateState } from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("react", () => ({
  useSyncExternalStore: vi.fn((_subscribe, getSnapshot) => getSnapshot()),
}));
vi.mock("../confirmDialog", () => ({ requestConfirmDialog: vi.fn() }));
vi.mock("../localApi", () => ({ ensureLocalApi: vi.fn() }));
vi.mock("../state/entities", () => ({ readThreadShells: vi.fn(() => []) }));
vi.mock("../state/environments", () => ({ readPrimaryEnvironmentId: vi.fn() }));
vi.mock("../components/ui/toast", () => ({ toastManager: { add: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const downloaded = (tag: string): DesktopForkUpdateState => ({
  status: "downloaded",
  tag,
  downloadedAt: 1_800_000_000_000,
  message: null,
});

async function createFixture() {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  vi.stubEnv("VITE_FORK_RELEASE_TAG", "v1+sidebar.1");
  vi.stubEnv("T3CODE_DESKTOP_UPDATE_REPOSITORY", "owner/repo");
  const local = deferred<DesktopForkUpdateState>();
  const download = deferred<DesktopForkUpdateState>();
  const bridge = {
    getState: vi.fn(() => local.promise),
    discard: vi.fn(async (): Promise<DesktopForkUpdateState> => ({
      status: "idle",
      tag: null,
      downloadedAt: null,
      message: null,
    })),
    download: vi.fn(() => download.promise),
    install: vi.fn(),
  };
  const fetchRelease = vi.fn(async () =>
    Response.json({ tag_name: "v1+sidebar.3", html_url: "https://github.com/owner/repo/releases" }),
  );
  vi.stubGlobal("fetch", fetchRelease);
  vi.stubGlobal("window", { desktopBridge: { forkUpdate: bridge } });
  const release = await import("./forkRelease");
  const { useSyncExternalStore } = await import("react");
  release.useForkReleaseStatus();
  const [subscribe] = vi.mocked(useSyncExternalStore).mock.calls[0]!;
  const getSnapshot = () => release.useForkReleaseStatus();
  const downloadSettled = deferred<void>();
  const stop = subscribe(() => {
    const local = getSnapshot().local;
    if (
      local?.status === "failed" ||
      local?.status === "installing" ||
      (local?.status === "downloaded" && local.tag === "v1+sidebar.3")
    ) {
      downloadSettled.resolve();
    }
  });
  return {
    release,
    local,
    download,
    bridge,
    fetchRelease,
    getSnapshot,
    downloadSettled: downloadSettled.promise,
    [Symbol.dispose]: stop,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fork release downloads", () => {
  it.each(["local first", "release first"])(
    "replaces a stale download when the latest release is detected (%s)",
    async (order) => {
      using fixture = await createFixture();
      if (order === "release first") await fixture.release.checkForkReleaseFromButton();
      fixture.local.resolve(downloaded("v1+sidebar.2"));
      await fixture.release.checkForkReleaseFromButton();

      expect(fixture.bridge.discard).toHaveBeenCalledTimes(1);
      expect(fixture.bridge.download).toHaveBeenCalledExactlyOnceWith("owner/repo", "v1+sidebar.3");
      expect(fixture.release.resolveForkUpdateAction(fixture.getSnapshot())).toMatchObject({
        kind: "download",
        release: { tag: "v1+sidebar.3" },
        busy: true,
      });

      fixture.download.resolve(downloaded("v1+sidebar.3"));
      await fixture.downloadSettled;
      expect(fixture.release.resolveForkUpdateAction(fixture.getSnapshot())).toEqual({
        kind: "install",
        tag: "v1+sidebar.3",
        busy: false,
      });
      expect(fixture.bridge.install).not.toHaveBeenCalled();
    },
  );

  it.each(["same release", "failed check"])("keeps the download after %s", async (scenario) => {
    using fixture = await createFixture();
    fixture.local.resolve(downloaded("v1+sidebar.3"));
    if (scenario === "failed check") fixture.fetchRelease.mockRejectedValue(new Error("Offline"));
    await fixture.release.checkForkReleaseFromButton();

    expect(fixture.bridge.discard).not.toHaveBeenCalled();
    expect(fixture.bridge.download).not.toHaveBeenCalled();
    expect(fixture.release.resolveForkUpdateAction(fixture.getSnapshot())).toEqual({
      kind: "install",
      tag: "v1+sidebar.3",
      busy: false,
    });
  });

  it("replaces a download that finishes after a newer release was detected", async () => {
    using fixture = await createFixture();
    const firstDownload = deferred<DesktopForkUpdateState>();
    fixture.bridge.download.mockReturnValueOnce(firstDownload.promise);
    fixture.local.resolve({ ...downloaded("v1+sidebar.2"), status: "downloading" });
    await fixture.release.checkForkReleaseFromButton();
    expect(fixture.bridge.discard).not.toHaveBeenCalled();

    firstDownload.resolve(downloaded("v1+sidebar.2"));
    await firstDownload.promise;
    await fixture.release.checkForkReleaseFromButton();
    expect(fixture.bridge.discard).toHaveBeenCalledTimes(1);
    expect(fixture.bridge.download.mock.calls).toEqual([
      ["owner/repo", "v1+sidebar.2"],
      ["owner/repo", "v1+sidebar.3"],
    ]);
  });

  it("offers a retry if the replacement download fails", async () => {
    using fixture = await createFixture();
    fixture.local.resolve(downloaded("v1+sidebar.2"));
    await fixture.release.checkForkReleaseFromButton();
    fixture.download.reject(new Error("Offline"));
    await fixture.downloadSettled;

    expect(fixture.getSnapshot().local).toMatchObject({ status: "failed", message: "Offline" });
    expect(fixture.release.resolveForkUpdateAction(fixture.getSnapshot())).toMatchObject({
      kind: "download",
      release: { tag: "v1+sidebar.3" },
      busy: false,
    });
    expect(fixture.bridge.download).toHaveBeenCalledTimes(1);
  });

  it.each(["idle", "installing"] as const)(
    "does not replace an update that is %s",
    async (status) => {
      using fixture = await createFixture();
      fixture.local.resolve({ ...downloaded("v1+sidebar.2"), status });
      await fixture.release.checkForkReleaseFromButton();

      expect(fixture.bridge.discard).not.toHaveBeenCalled();
      expect(fixture.bridge.download).not.toHaveBeenCalled();
    },
  );

  it.each(["installing", "downloaded"] as const)(
    "does not download over a previous update that remains %s after discard",
    async (status) => {
      using fixture = await createFixture();
      fixture.bridge.discard.mockResolvedValue({ ...downloaded("v1+sidebar.2"), status });
      fixture.local.resolve(downloaded("v1+sidebar.2"));
      await fixture.release.checkForkReleaseFromButton();

      expect(fixture.bridge.download).not.toHaveBeenCalled();
      await fixture.downloadSettled;
      expect(fixture.getSnapshot().local?.status).toBe(status === "downloaded" ? "failed" : status);
      expect(fixture.bridge.discard).toHaveBeenCalledTimes(1);
    },
  );
});
