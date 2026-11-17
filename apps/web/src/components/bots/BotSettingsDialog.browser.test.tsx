import "../../index.css";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { AsyncResult } from "effect/reactivity";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import { useQuietThreadShell } from "../../state/entities";
import { useEnvironmentScope } from "../../state/session";
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
