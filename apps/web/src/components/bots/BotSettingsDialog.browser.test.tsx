import "../../index.css";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { RegistryContext } from "@effect/atom-react";
import { DEFAULT_SERVER_SETTINGS, ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import { useQuietThreadShell, useQuietThreadShells } from "../../state/entities";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { serverEnvironment } from "../../state/server";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { BotSettingsDialog } from "./BotSettingsDialog";
import { useState } from "react";

vi.mock("../../state/entities", { spy: true });
vi.mock("../../state/session", { spy: true });
vi.mock("../../state/use-orchestration-command", { spy: true });

it("keeps settings when disabling is canceled and removes them only after confirmation", async () => {
  const shell = makeThreadFixture({
    bot: {
      objective: "Review work",
      skillPath: "~/review/SKILL.md",
      statePath: "~/review.sqlite",
      freshAfterTurns: 12,
    },
  });
  const ref = scopeThreadRef(shell.environmentId, shell.id);
  const update = vi.fn().mockResolvedValue(AsyncResult.success(undefined));
  vi.mocked(useQuietThreadShell).mockReturnValue(shell);
  vi.mocked(useEnvironmentScope).mockReturnValue(true);
  vi.mocked(useOrchestrationCommand).mockReturnValue(update);
  function Settings() {
    const [open, setOpen] = useState(true);
    return open ? <BotSettingsDialog threadRef={ref} onClose={() => setOpen(false)} /> : null;
  }
  await using _screen = await render(<Settings />);
  const dialog = page.getByRole("dialog", { name: "Bot settings" });
  await userEvent.click(dialog.getByRole("button", { name: "Activity", exact: true }));
  await expect.element(dialog.getByRole("button", { name: "History", exact: true })).toBeDisabled();
  await userEvent.click(dialog.getByRole("button", { name: "Quiet", exact: true }));
  await userEvent.click(dialog.getByRole("button", { name: "History", exact: true }));
  await expect
    .element(dialog.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.fill(
    dialog.getByRole("textbox", { name: "Standing objective" }),
    "Keep my edits",
  );
  await userEvent.click(dialog.getByRole("button", { name: "Disable bot", exact: true }));
  const warning = page.getByRole("alertdialog", { name: "Disable bot?" });
  await expect.element(warning).toBeVisible();
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(warning.getByRole("button", { name: "Cancel" }));
  await expect.element(warning).not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole("textbox", { name: "Standing objective" }))
    .toHaveValue("Keep my edits");
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", { name: "Disable bot", exact: true }));
  await userEvent.click(warning.getByRole("button", { name: "Disable bot", exact: true }));
  await expect.element(dialog).not.toBeInTheDocument();
  expect(update).toHaveBeenCalledExactlyOnceWith({
    environmentId: ref.environmentId,
    input: { threadId: ref.threadId, bot: null },
  });
});

it("suggests a separate state path and lets two bots intentionally share one", async () => {
  const shell = makeThreadFixture({ id: ThreadId.make("releases"), bot: null });
  const existing = makeThreadFixture({
    id: ThreadId.make("reviews"),
    title: "Review desk",
    bot: {
      skillPath: "~/review.md",
      statePath: "~/review.sqlite",
      objective: "Review",
      freshAfterTurns: 12,
    },
  });
  vi.mocked(useQuietThreadShell).mockReturnValue(shell);
  vi.mocked(useQuietThreadShells).mockReturnValue([existing, shell]);
  vi.mocked(useEnvironmentScope).mockReturnValue(true);
  await using screen = await render(
    <BotSettingsDialog
      threadRef={scopeThreadRef(shell.environmentId, shell.id)}
      onClose={() => {}}
    />,
  );
  const path = screen.getByRole("textbox", { name: "Durable work state path" });
  await expect.element(path).toHaveValue("~/.local/share/t3/bots/bot-releases/work.sqlite");
  await userEvent.fill(path, "~/review.sqlite");
  await expect.element(screen.getByText(/Also used by Review desk/)).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Save bot" })).toBeEnabled();
});

it("edits and resets a bot's icon color without changing its standing settings", async () => {
  const bot = {
    objective: "Review work",
    skillPath: "~/review/SKILL.md",
    statePath: "~/review.sqlite",
    freshAfterTurns: 12,
    iconColor: "green" as const,
  };
  const shell = makeThreadFixture({ bot });
  const ref = scopeThreadRef(shell.environmentId, shell.id);
  const update = vi.fn().mockResolvedValue(AsyncResult.success(undefined));
  const onClose = vi.fn();
  vi.mocked(useQuietThreadShell).mockReturnValue(shell);
  vi.mocked(useEnvironmentScope).mockReturnValue(true);
  vi.mocked(useOrchestrationCommand).mockReturnValue(update);
  await using screen = await render(<BotSettingsDialog threadRef={ref} onClose={onClose} />);
  const colors = page.getByRole("group", { name: "Bot icon color" });
  await expect
    .element(colors.getByRole("button", { name: "Green", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.click(colors.getByRole("button", { name: "Purple", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Save bot", exact: true }));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(update).toHaveBeenLastCalledWith({
    environmentId: ref.environmentId,
    input: { threadId: ref.threadId, bot: { ...bot, iconColor: "purple" } },
  });
  await screen.rerender(<BotSettingsDialog key="reset" threadRef={ref} onClose={onClose} />);
  await userEvent.click(page.getByRole("button", { name: "Default", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Save bot", exact: true }));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  const { iconColor: _iconColor, ...defaultBot } = bot;
  expect(update).toHaveBeenLastCalledWith({
    environmentId: ref.environmentId,
    input: { threadId: ref.threadId, bot: defaultBot },
  });
});

it("retries a sync command edit after the bot settings were saved", async () => {
  const bot = {
    objective: "Review work",
    skillPath: "~/review/SKILL.md",
    statePath: "~/review.sqlite",
    freshAfterTurns: 12,
  };
  const shell = makeThreadFixture({ bot });
  const ref = scopeThreadRef(shell.environmentId, shell.id);
  const registry = AtomRegistry.make({
    initialValues: [
      [
        serverEnvironment.configValueAtom(ref.environmentId),
        {
          environment: { capabilities: { botSync: true } },
          settings: {
            ...DEFAULT_SERVER_SETTINGS,
            botSyncCommands: { [shell.id]: "sync previous" },
          },
        },
        { skipInitialRun: true },
      ],
    ],
  });
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const update = vi.fn().mockResolvedValue(AsyncResult.success(undefined));
  const onClose = vi.fn();
  vi.mocked(useQuietThreadShell).mockReturnValue(shell);
  vi.mocked(useEnvironmentScope).mockReturnValue(true);
  vi.mocked(readEnvironmentScope).mockReturnValue(true);
  vi.mocked(useOrchestrationCommand).mockReturnValue(update);
  await using _screen = await render(
    <RegistryContext value={registry}>
      <BotSettingsDialog threadRef={ref} onClose={onClose} />
    </RegistryContext>,
  );
  using saveSettings = vi
    .spyOn(serverEnvironment.updateSettings, "run")
    .mockResolvedValueOnce(AsyncResult.failure(Cause.die(new Error("Disconnected"))))
    .mockResolvedValueOnce(AsyncResult.success(DEFAULT_SERVER_SETTINGS));
  const dialog = page.getByRole("dialog", { name: "Bot settings" });
  const command = dialog.getByRole("textbox", { name: "Background sync command" });
  await expect.element(command).toHaveValue("sync previous");
  await userEvent.fill(
    dialog.getByRole("textbox", { name: "Standing objective" }),
    "Review all work",
  );
  await userEvent.fill(command, "");
  const save = dialog.getByRole("button", { name: "Save bot" });
  await userEvent.click(save);
  await expect
    .element(dialog.getByRole("alert"))
    .toHaveTextContent(
      "Bot settings saved. Could not save the sync command. Click Save bot to retry.",
    );
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(save);
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(saveSettings).toHaveBeenLastCalledWith(registry, {
    environmentId: ref.environmentId,
    input: { patch: { botSyncCommands: { [shell.id]: null } } },
  });
});
