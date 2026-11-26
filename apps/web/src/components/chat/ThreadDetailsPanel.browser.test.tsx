import {
  DEFAULT_CLIENT_SETTINGS,
  EnvironmentId,
  MessageId,
  ProjectId,
  ThreadId,
  type OrchestrationV2ProjectedTurnItem,
  type ScopedThreadRef,
  type ThreadPullRequestLink,
} from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

const SCRATCH_ROOT = "/home/user/.t3/scratch";

const state = vi.hoisted(() => ({
  workspaceRoot: "",
  folder: "",
  pullRequests: [] as unknown[],
  configLoaded: true,
  items: [] as OrchestrationV2ProjectedTurnItem[],
}));

vi.mock(import("~/state/entities"), async (importOriginal) => ({
  ...(await importOriginal()),
  useProject: ((ref: unknown) =>
    ref === null
      ? null
      : {
          id: "project",
          environmentId: "environment",
          title: state.workspaceRoot === SCRATCH_ROOT ? "No project" : "plain",
          workspaceRoot: state.workspaceRoot,
          scripts: [],
        }) as never,
  useProjects: (() => []) as never,
  useTimelineVisibleTurnItems: () => state.items,
  useQuietThreadShell: ((ref: unknown) =>
    ref === null
      ? null
      : {
          id: "thread",
          environmentId: "environment",
          projectId: "project",
          worktreePath: state.folder,
          branch: null,
          pullRequests: state.pullRequests,
        }) as never,
  useServerConfigs: (() =>
    new Map(
      state.configLoaded
        ? [
            [
              EnvironmentId.make("environment"),
              {
                scratchWorkspaceRoot: SCRATCH_ROOT,
                environment: { capabilities: { pullRequests: true } },
              },
            ],
          ]
        : [],
    )) as never,
}));
// Neither folder is a repository, which is what the server reports for both.
vi.mock(import("~/state/vcs"), async (importOriginal) => {
  const actual = await importOriginal();
  const notARepo = Atom.make(
    AsyncResult.success({
      isRepo: false,
      hasPrimaryRemote: false,
      isDefaultRef: false,
      refName: null,
      hasWorkingTreeChanges: false,
      workingTree: { files: [], insertions: 0, deletions: 0 },
      hasUpstream: false,
      aheadCount: 0,
      behindCount: 0,
      aheadOfDefaultCount: 0,
      pr: null,
    }),
  );
  return {
    ...actual,
    vcsEnvironment: { ...actual.vcsEnvironment, status: (() => notARepo) as never },
  };
});

import { act, render } from "../../../test/render";
import { __setClientSettingsForTests, updateClientSettings } from "../../hooks/useSettings";
import { makeStreamingTimelineFixture } from "../../test-fixtures";
import { useRightPanelStore } from "../../rightPanelStore";
import { PopoverCreateHandle } from "../ui/popover";
import { ChatCanvasContext } from "./ChatCanvasContext";
import { resolveChatCanvasLayout } from "./chatCanvasLayout";
import { ThreadDetailsPanel } from "./ThreadDetailsPanel";

const threadRef: ScopedThreadRef = {
  environmentId: EnvironmentId.make("environment"),
  threadId: ThreadId.make("thread"),
};
const container = { width: 1200, height: 800 };
const placement = { x: 908, y: 0, right: 12, width: 280, height: 760 } as const;
const linkedPullRequest: ThreadPullRequestLink = {
  host: "github.com",
  repository: "pingdotgg/t3code",
  number: 27513,
  url: "https://github.com/pingdotgg/t3code/pull/27513",
  source: "manual",
  linkedAt: "2026-10-30T00:00:00.000Z",
  snapshot: null,
  stack: null,
};

function setup(input: {
  workspaceRoot: string;
  folder: string;
  pullRequests?: ThreadPullRequestLink[];
  configLoaded?: boolean;
  message?: string;
}) {
  state.configLoaded = input.configLoaded ?? true;
  state.workspaceRoot = input.workspaceRoot;
  state.folder = input.folder;
  state.pullRequests = input.pullRequests ?? [];
  const { base, runId } = makeStreamingTimelineFixture();
  const item = {
    ...base("message", runId, 0),
    type: "user_message" as const,
    messageId: MessageId.make("message"),
    text: input.message ?? "",
    attachments: [],
    inputIntent: "turn_start" as const,
    createdBy: "user" as const,
    creationSource: "web" as const,
  };
  state.items = input.message
    ? [
        {
          item,
          sourceThreadId: threadRef.threadId,
          sourceItemId: item.id,
          position: 0,
          visibility: "local",
        },
      ]
    : [];
  __setClientSettingsForTests(DEFAULT_CLIENT_SETTINGS);
  useRightPanelStore.setState({ threadPanelVisibilityByThreadKey: {} });
  const anchor = document.createElement("div");
  document.body.append(anchor);
  return {
    anchor: { current: anchor },
    handle: PopoverCreateHandle(),
    [Symbol.dispose]: () => {
      anchor.remove();
      __setClientSettingsForTests(DEFAULT_CLIENT_SETTINGS);
    },
  };
}

const machines = (["This Mac", "Server"] as const).map((label, index) => ({
  environmentId: EnvironmentId.make(index === 0 ? "environment" : "other"),
  projectId: ProjectId.make("project"),
  label,
  isPrimary: index === 0,
  machine: "server" as const,
}));

function Panel({
  fixture,
  draftEnvMode,
  onMachines = false,
}: {
  fixture: ReturnType<typeof setup>;
  /** Renders an unsent draft in this mode instead of a started thread. */
  draftEnvMode?: "local" | "worktree";
  onMachines?: boolean;
}) {
  const noop = () => {};
  const scriptResult = async () => ({ ok: true }) as never;
  return (
    <ChatCanvasContext
      value={{
        container,
        lane: { padding: 48, minChatWidth: 640 },
        layout: resolveChatCanvasLayout({ container, preview: null }),
        previewKey: null,
        registerTimeline: noop,
        measureDetailsCard: noop,
        detailsCardTopInset: 0,
        preferredDetailsCard: placement,
        detailsCardPlacement: placement,
      }}
    >
      <ThreadDetailsPanel
        anchor={fixture.anchor}
        handle={fixture.handle}
        environmentId={threadRef.environmentId}
        threadId={threadRef.threadId}
        projectId={ProjectId.make("project")}
        composerDraftTarget={threadRef}
        worktreePath={draftEnvMode === undefined ? state.folder : null}
        isServerThread={draftEnvMode === undefined}
        activeProjectName={state.workspaceRoot === SCRATCH_ROOT ? "No project" : "plain"}
        activeProjectScripts={undefined}
        preferredScriptId={null}
        keybindings={[]}
        availableEditors={[]}
        showOpenInPicker={false}
        openInShortcutEnabled={false}
        gitCwd={state.folder}
        workspaceMutationId={null}
        isGitRepo={false}
        offersWorkspaceModes={false}
        envLocked={draftEnvMode === undefined}
        availableEnvironments={onMachines ? machines : []}
        {...(onMachines ? { onEnvironmentChange: noop } : {})}
        onEnvModeChange={noop}
        envMode={draftEnvMode ?? "local"}
        startFromOrigin={false}
        onStartFromOriginChange={noop}
        onComposerFocusRequest={noop}
        onRunProjectScript={noop}
        onAddProjectScript={scriptResult}
        onUpdateProjectScript={scriptResult}
        onDeleteProjectScript={scriptResult}
        usage={{} as never}
      />
    </ChatCanvasContext>
  );
}

it("offers no git controls in a No project thread, but shows its linked pull request", async () => {
  using fixture = setup({
    workspaceRoot: SCRATCH_ROOT,
    folder: `${SCRATCH_ROOT}/thread`,
    pullRequests: [linkedPullRequest],
  });
  await using _screen = await render(<Panel fixture={fixture} />);
  await expect.element(page.getByText("#27513")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Initialize Git" }))
    .not.toBeInTheDocument();
});

it("shows Current checkout where no worktree can come from, even when New worktree is the default", async () => {
  using fixture = setup({ workspaceRoot: SCRATCH_ROOT, folder: SCRATCH_ROOT });
  await using _screen = await render(<Panel fixture={fixture} draftEnvMode="worktree" />);
  await expect.element(page.getByLabelText("Run context: Current checkout")).toBeVisible();
  await expect.element(page.getByRole("button", { name: /Run context/ })).not.toBeInTheDocument();
});

it("offers only machines where no worktree can come from and several machines exist", async () => {
  using fixture = setup({ workspaceRoot: SCRATCH_ROOT, folder: SCRATCH_ROOT });
  await using _screen = await render(
    <Panel fixture={fixture} draftEnvMode="worktree" onMachines />,
  );
  await page.getByRole("button", { name: "Run context: This Mac, Current checkout" }).click();
  await expect.element(page.getByText("Run on")).toBeVisible();
  await expect.element(page.getByText("New worktree")).not.toBeInTheDocument();
});

it("shows a linked pull request in a folder that is not a git repository", async () => {
  using fixture = setup({
    workspaceRoot: "/work/plain",
    folder: "/work/plain",
    pullRequests: [linkedPullRequest],
  });
  await using _screen = await render(<Panel fixture={fixture} />);
  await expect.element(page.getByRole("region", { name: "Workspace" })).toBeVisible();
  await expect.element(page.getByText("#27513")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Initialize Git" })).toBeVisible();
});

it("offers no Initialize Git before the server config says where No project lives", async () => {
  using fixture = setup({
    workspaceRoot: SCRATCH_ROOT,
    folder: `${SCRATCH_ROOT}/thread`,
    configLoaded: false,
  });
  await using _screen = await render(<Panel fixture={fixture} />);
  await expect.element(page.getByRole("region", { name: "Workspace" })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Initialize Git" }))
    .not.toBeInTheDocument();
});

it("shows chat-derived PRs only when their matching richer rows are not displayed", async () => {
  using fixture = setup({
    workspaceRoot: "/work/plain",
    folder: "/work/plain",
    pullRequests: [
      linkedPullRequest,
      {
        ...linkedPullRequest,
        number: 27512,
        linkedAt: "2026-10-29T00:00:00.000Z",
        url: "https://github.com/pingdotgg/t3code/pull/27512",
      },
      {
        ...linkedPullRequest,
        host: "git.example.com",
        url: "https://git.example.com/pingdotgg/t3code/pull/27513",
        linkedAt: "2026-10-28T00:00:00.000Z",
      },
    ],
    message: [
      "https://www.github.com/PINGDOTGG/T3Code/pull/27513/files",
      "https://github.com/pingdotgg/t3code/pull/27512",
      "https://github.com/other/t3code/pull/27513",
      "https://example.atlassian.net/browse/WORK-123",
    ].join(" "),
  });
  await using _screen = await render(<Panel fixture={fixture} />);
  const current = page.getByText("PINGDOTGG/T3Code#27513", { exact: true });
  const extra = page.getByText("pingdotgg/t3code#27512", { exact: true });
  const chatOnly = page.getByText("other/t3code#27513", { exact: true });
  const jira = page.getByText("WORK-123", { exact: true });
  const pullRequests = page.getByRole("region", { name: "Pull requests" });
  await expect.element(pullRequests.getByText("#27513", { exact: true })).toBeVisible();
  await expect.element(pullRequests.getByText("other/t3code#27513", { exact: true })).toBeVisible();
  await expect.element(page.getByText("#27513", { exact: true })).toHaveLength(1);
  await expect.element(current).not.toBeInTheDocument();
  await expect.element(extra).toBeVisible();
  await expect.element(chatOnly).toBeVisible();
  await expect.element(jira).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Show 2 more" }));
  await expect.element(page.getByText("#27512", { exact: true })).toBeVisible();
  await expect.element(extra).not.toBeInTheDocument();
  await userEvent.click(page.getByRole("button", { name: "Show less" }));
  await expect.element(extra).toBeVisible();
  await act(() => updateClientSettings({ threadDetailsItems: { branch: false } }));
  await expect.element(page.getByText("#27513", { exact: true })).not.toBeInTheDocument();
  await expect.element(current).toBeVisible();
  await expect.element(extra).toBeVisible();
  await expect.element(chatOnly).toBeVisible();
  await expect.element(jira).toBeVisible();
  await act(() => updateClientSettings({ threadDetailsItems: { branch: true, links: false } }));
  await expect.element(page.getByText("#27513", { exact: true })).toBeVisible();
  await expect.element(current).not.toBeInTheDocument();
  await expect.element(chatOnly).not.toBeInTheDocument();
  await expect.element(jira).not.toBeInTheDocument();
});
