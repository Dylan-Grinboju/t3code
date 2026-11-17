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
  const onActivity = vi.fn();
  const onHistory = vi.fn();
  await using screen = await render(
    <BotControls
      threadRef={ref}
      bot={bot}
      canOperate
      activity={false}
      history={false}
      onActivity={onActivity}
      onHistory={onHistory}
    />,
  );
  await expect.element(screen.getByText(bot.objective)).toBeVisible();
  await expect.element(screen.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Work", exact: true }));
  await expect
    .element(screen.getByRole("link", { name: /Coach my PR/ }))
    .toHaveAttribute("href", `/${shell.environmentId}/${child.id}`);
  await expect.element(screen.getByText("Background worker inspector")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Activity", exact: true }));
  expect(onActivity).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "History", exact: true }));
  expect(onHistory).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Work", exact: true }));
  await expect.element(screen.getByRole("region", { name: "Bot work" })).not.toBeInTheDocument();
});
