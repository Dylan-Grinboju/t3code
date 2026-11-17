import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { render } from "../../../test/render";
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
import { BotControls } from "../chat/BotControls";

vi.mock("../../state/entities", { spy: true });
vi.mock("../chat/ThreadRelationshipsControl", () => ({
  ThreadRelationshipsPanel: () => <div>Background worker inspector</div>,
}));

it("opens work conversations from recorded creation events and keeps activity controls independent", async () => {
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
  function BotView() {
    const [activity, setActivity] = useState(false);
    const [history, setHistory] = useState(false);
    return (
      <BotControls
        threadRef={ref}
        bot={bot}
        canOperate
        activity={activity}
        history={history}
        onActivity={() => setActivity(!activity)}
        onHistory={() => setHistory(!history)}
      />
    );
  }
  await using screen = await render(<BotView />);
  await expect.element(screen.getByText(bot.objective)).toBeVisible();
  await expect.element(screen.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Work", exact: true }));
  await expect
    .element(screen.getByRole("link", { name: /Coach my PR/ }))
    .toHaveAttribute("href", `/${shell.environmentId}/${child.id}`);
  await expect.element(screen.getByText("Background worker inspector")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Activity", exact: true }));
  await expect
    .element(screen.getByRole("button", { name: "Activity", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect.element(screen.getByRole("button", { name: "History", exact: true })).toBeDisabled();
  await expect.element(screen.getByRole("region", { name: "Bot work" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Quiet", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "History", exact: true }));
  await expect
    .element(screen.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "Activity", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Quiet", exact: true }));
  await expect
    .element(screen.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "Bot settings", exact: true }));
  await expect.element(screen.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("form", { name: "Bot settings", exact: true }))
    .toBeVisible();
  await userEvent.fill(
    screen.getByRole("textbox", { name: "Standing objective" }),
    "Keep this unsaved objective",
  );
  await userEvent.click(screen.getByRole("button", { name: "Work", exact: true }));
  await expect
    .element(screen.getByRole("form", { name: "Bot settings", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("region", { name: "Bot work" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Work", exact: true }));
  await expect.element(screen.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("textbox", { name: "Standing objective" }))
    .toHaveValue("Keep this unsaved objective");
});
