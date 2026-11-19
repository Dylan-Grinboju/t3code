import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { RegistryContext } from "@effect/atom-react";
import { DEFAULT_SERVER_SETTINGS, ThreadId, type ServerSettings } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { act, render } from "../../../test/render";
import {
  makeStreamingTimelineFixture,
  makeThreadFixture,
  makeThreadProjectionFixture,
} from "../../test-fixtures";
import {
  useQuietThreadProjection,
  useQuietThreadShell,
  useHiddenThreadKeys,
} from "../../state/entities";
import { FloatingChatHeader } from "../chat/MaximizedChatControls";
import { runBotSync } from "../../state/orchestration";
import { serverEnvironment } from "../../state/server";
import { toastManager } from "../ui/toast";
import { BotHeaderActions } from "./BotHeaderActions";

vi.mock("../../state/entities", { spy: true });
vi.mock("../chat/ThreadRelationshipsControl", () => ({
  ThreadRelationshipsPanel: () => <div>Background worker inspector</div>,
}));

it("opens work conversations from the header without occupying the timeline", async () => {
  const bot = {
    objective: "Organize my engineering work",
    skillPath: "~/skill.md",
    statePath: "~/work.sqlite",
    freshAfterTurns: 12,
  };
  const shell = makeThreadFixture({ bot, title: "Chief of Staff" });
  const ref = scopeThreadRef(shell.environmentId, shell.id);
  const child = makeThreadFixture({ id: ThreadId.make("coach"), title: "Coach my PR" });
  vi.mocked(useQuietThreadShell).mockImplementation((requested) =>
    requested?.threadId === child.id ? child : shell,
  );
  vi.mocked(useHiddenThreadKeys).mockReturnValue(new Set());
  const fixture = makeStreamingTimelineFixture("");
  const base = fixture.base("created-work", fixture.runId, 0);
  vi.mocked(useQuietThreadProjection).mockReturnValue({
    environmentId: shell.environmentId,
    projection: {
      ...makeThreadProjectionFixture(),
      turnItems: [
        {
          ...base,
          type: "thread_created",
          targetThreadId: child.id,
          targetRunId: null,
          targetProviderInstanceId: child.providerInstanceId,
          targetModel: "test",
          title: "Original coach title",
        },
      ],
    },
  });
  const toggle = vi.fn();
  await using screen = await render(
    <FloatingChatHeader
      title={shell.title}
      threadRef={ref}
      expanded
      onToggle={toggle}
      onMinimize={() => {}}
    />,
  );
  await expect.element(page.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Bot work", exact: true }));
  await expect
    .element(page.getByRole("link", { name: /Coach my PR/ }))
    .toHaveAttribute("href", `/${shell.environmentId}/${child.id}`);
  await expect.element(page.getByText("Background worker inspector")).toBeVisible();
  expect(toggle).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
});

it("runs the configured bot sync on its host and allows another attempt after dispatch", async () => {
  const bot = {
    objective: "Refresh work",
    skillPath: "~/skill.md",
    statePath: "~/work.sqlite",
    freshAfterTurns: 12,
  };
  const shell = makeThreadFixture({ bot });
  const ref = scopeThreadRef(shell.environmentId, shell.id);
  vi.mocked(useQuietThreadShell).mockReturnValue(shell);
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(runBotSync.permissionAtom(ref.environmentId), true, {
        skipInitialRun: true,
      }),
      [
        serverEnvironment.configValueAtom(ref.environmentId),
        {
          environment: { capabilities: { botSync: true } },
          settings: {
            ...DEFAULT_SERVER_SETTINGS,
            botSyncCommands: { [ref.threadId]: "true" },
          } satisfies ServerSettings,
        },
        { skipInitialRun: true },
      ],
    ],
  });
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const view = (target = ref) => (
    <RegistryContext value={registry}>
      <BotHeaderActions threadRef={target} />
    </RegistryContext>
  );
  await using screen = await render(view());
  let finishStarting!: () => void;
  const pending = new Promise<void>((resolve) => {
    finishStarting = resolve;
  });
  using launch = vi
    .spyOn(runBotSync, "run")
    .mockImplementationOnce(async () => {
      await pending;
      return AsyncResult.success({ status: "started" });
    })
    .mockResolvedValueOnce(AsyncResult.success({ status: "already-running" }));
  using feedback = vi.spyOn(toastManager, "add").mockReturnValue("toast");

  const sync = screen.getByRole("button", { name: "Sync now" });
  await sync.click();
  await expect.element(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
  expect(launch).toHaveBeenCalledExactlyOnceWith(registry, {
    environmentId: ref.environmentId,
    input: { threadId: ref.threadId },
  });
  await act(finishStarting);
  await expect.element(sync).toBeEnabled();
  expect(feedback).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: "Background sync started" }),
  );
  await sync.click();
  expect(feedback).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: "Background sync is already running" }),
  );

  const other = makeThreadFixture({ id: ThreadId.make("other"), bot });
  vi.mocked(useQuietThreadShell).mockReturnValue(other);
  await screen.rerender(view(scopeThreadRef(other.environmentId, other.id)));
  await expect.element(sync).not.toBeInTheDocument();
});
