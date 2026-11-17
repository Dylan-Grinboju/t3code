import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
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
import { FloatingChatHeader } from "../chat/MaximizedChatControls";

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
