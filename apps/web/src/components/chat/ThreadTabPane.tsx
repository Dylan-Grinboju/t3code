import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type ScopedThreadRef,
  type ThreadId,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpLeftIcon, ChevronDownIcon, FolderGitIcon, FolderIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ComposerHandleContext } from "../../composerHandleContext";
import { useStableCallback } from "../../hooks/useStableCallback";
import type { SideChatParentPanel } from "../../lib/sideChatPane";
import { isSideChatOf, openThreadTab, promoteThreadTab } from "../../lib/threadTabs";
import { newThreadId } from "../../lib/utils";
import { hostRightPanel } from "../../rightPanelStore";
import {
  readThreadShell,
  readThreadShells,
  useQuietThreadShell,
  waitForThreadShell,
} from "../../state/entities";
import { useEnvironmentScope } from "../../state/session";
import { useEnvironmentShellHasSnapshot } from "../../state/shell";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import ChatView from "../ChatView";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { BackgroundThreadContext } from "./backgroundThread";
import SideChatPane from "./SideChatPane";
import { ThreadTabDetailsContext } from "./threadTabDetails";

interface PaneProps {
  readonly parentRef: ScopedThreadRef;
  readonly threadId: ThreadId;
  readonly parentPanel: SideChatParentPanel;
  readonly onClose: () => void;
}

/** A side chat of the host keeps its own pane; any other thread opens as a thread tab. */
export default function ThreadSurfacePane(props: PaneProps) {
  const shell = useQuietThreadShell(scopeThreadRef(props.parentRef.environmentId, props.threadId));
  if (shell === null || isSideChatOf(shell, props.parentRef)) return <SideChatPane {...props} />;
  return <ThreadTabPane {...props} />;
}

const MAIN_CHECKOUT = "main";
const PROJECT_FOLDER = "project";
const NEW_WORKTREE = "new-worktree";

function checkoutLabel(worktreePath: string | null, mainWorktreePath: string | null) {
  if (worktreePath === mainWorktreePath) return "Main thread's checkout";
  if (worktreePath === null) return "Project folder";
  return worktreePath.split(/[\\/]/).at(-1) ?? worktreePath;
}

/** Other worktrees threads of the project already use, by path, with their branch. */
function projectWorktrees(
  threadRef: ScopedThreadRef,
  projectId: string,
  exclude: ReadonlySet<string>,
) {
  const worktrees = new Map<string, string | null>();
  for (const thread of readThreadShells()) {
    if (thread.environmentId !== threadRef.environmentId || thread.projectId !== projectId)
      continue;
    if (thread.worktreePath === null || exclude.has(thread.worktreePath)) continue;
    if (!worktrees.has(thread.worktreePath)) worktrees.set(thread.worktreePath, thread.branch);
  }
  return [...worktrees];
}

/** Picks the checkout of a thread tab that has no messages yet. */
function ThreadTabCheckoutMenu(props: {
  readonly threadRef: ScopedThreadRef;
  readonly mainRef: ScopedThreadRef;
  /** The full composer, where a new worktree is chosen, only shows in the main chat. */
  readonly onMakeMain: () => void;
}) {
  const shell = useQuietThreadShell(props.threadRef);
  const main = useQuietThreadShell(props.mainRef);
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  if (shell === null || main === null) return null;
  const current = shell.worktreePath;
  const value =
    current === main.worktreePath ? MAIN_CHECKOUT : current === null ? PROJECT_FOLDER : current;
  const choose = async (next: string) => {
    if (next === value) return;
    if (next === NEW_WORKTREE && current === null) {
      props.onMakeMain();
      return;
    }
    const target =
      next === MAIN_CHECKOUT
        ? { worktreePath: main.worktreePath, branch: main.branch }
        : next === PROJECT_FOLDER || next === NEW_WORKTREE
          ? { worktreePath: null, branch: null }
          : {
              worktreePath: next,
              branch:
                readThreadShells().find((thread) => thread.worktreePath === next)?.branch ?? null,
            };
    const result = await updateMetadata({
      environmentId: props.threadRef.environmentId,
      input: { threadId: props.threadRef.threadId, ...target, expectedEmpty: true },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not change the checkout",
        ...(error instanceof Error ? { description: error.message } : {}),
      });
    } else if (result._tag === "Success" && next === NEW_WORKTREE) {
      props.onMakeMain();
    }
  };
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="xs" aria-label="Checkout" />}>
        {current === null ? <FolderIcon /> : <FolderGitIcon />}
        <span className="max-w-32 truncate">{checkoutLabel(current, main.worktreePath)}</span>
        <ChevronDownIcon />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuRadioGroup value={value} onValueChange={(next) => void choose(String(next))}>
          <MenuRadioItem value={MAIN_CHECKOUT} closeOnClick>
            Main thread's checkout
          </MenuRadioItem>
          {main.worktreePath === null ? null : (
            <MenuRadioItem value={PROJECT_FOLDER} closeOnClick>
              Project folder
            </MenuRadioItem>
          )}
          {projectWorktrees(
            props.threadRef,
            shell.projectId,
            new Set(main.worktreePath === null ? [] : [main.worktreePath]),
          ).map(([path, branch]) => (
            <MenuRadioItem key={path} value={path} closeOnClick>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{branch ?? checkoutLabel(path, null)}</span>
                <span className="truncate text-muted-foreground text-xs">{path}</span>
              </span>
            </MenuRadioItem>
          ))}
          <MenuRadioItem value={NEW_WORKTREE} closeOnClick>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">New worktree…</span>
              <span className="truncate text-muted-foreground text-xs">
                Opens it as the main chat; choose it under Run context
              </span>
            </span>
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

/** A thread tab: its title, checkout while empty, Make main and Close, over the thread's chat. */
function ThreadTabPane(props: PaneProps) {
  const { parentRef, threadId } = props;
  const threadRef = scopeThreadRef(parentRef.environmentId, threadId);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- registers the main thread's panel as host in the panel store
  useEffect(
    () => hostRightPanel(scopeThreadRef(parentRef.environmentId, threadId), parentRef),
    [parentRef, threadId],
  );
  const navigate = useNavigate();
  const shell = useQuietThreadShell(threadRef);
  const snapshotLoaded = useEnvironmentShellHasSnapshot(parentRef.environmentId);
  const canOperate = useEnvironmentScope(parentRef.environmentId, AuthOrchestrationOperateScope);
  const empty = shell !== null && shell.latestRun === null && shell.latestUserMessageAt === null;
  const headerRef = useRef<HTMLDivElement>(null);
  const [detailsSlot, setDetailsSlot] = useState<HTMLSpanElement | null>(null);
  const makeMain = () => {
    const target = promoteThreadTab(parentRef, threadId, { closeHost: false });
    void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(target) });
  };

  return (
    <div data-side-chat-pane className="flex h-full min-h-0 flex-col">
      <div
        ref={headerRef}
        className="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1 pl-3"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {shell?.title ?? "Thread"}
        </span>
        {empty && canOperate ? (
          <ThreadTabCheckoutMenu threadRef={threadRef} mainRef={parentRef} onMakeMain={makeMain} />
        ) : null}
        <span ref={setDetailsSlot} className="flex shrink-0 empty:hidden" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Make main thread"
                disabled={shell === null}
                onClick={makeMain}
              >
                <ArrowUpLeftIcon />
              </Button>
            }
          />
          <TooltipPopup side="bottom">
            Make this the main chat; the main chat becomes a tab.
          </TooltipPopup>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close thread tab"
          onClick={props.onClose}
        >
          <XIcon />
        </Button>
      </div>
      {shell === null ? (
        snapshotLoaded ? (
          <p className="p-3 text-xs text-muted-foreground">This thread was deleted.</p>
        ) : null
      ) : (
        <BackgroundThreadContext value>
          <ComposerHandleContext value={null}>
            <ThreadTabDetailsContext value={{ anchor: headerRef, slot: detailsSlot }}>
              <ChatView
                environmentId={parentRef.environmentId}
                threadId={threadId}
                routeKind="server"
                embedded={props.parentPanel}
              />
            </ThreadTabDetailsContext>
          </ComposerHandleContext>
        </BackgroundThreadContext>
      )}
    </div>
  );
}

/**
 * Starts a thread in a new tab of `host`, in the host's checkout and with its model and modes.
 * Resolves false when nothing started, or another one is still starting.
 */
export function useNewThreadTab(host: ScopedThreadRef | null) {
  const pendingRef = useRef(false);
  const createThread = useAtomCommand(threadEnvironment.create, { reportFailure: false });
  const start = async () => {
    const hostShell = host === null ? null : readThreadShell(host);
    if (host === null || hostShell === null || pendingRef.current) return false;
    pendingRef.current = true;
    try {
      const threadId = newThreadId();
      const result = await createThread({
        environmentId: host.environmentId,
        input: {
          threadId,
          projectId: hostShell.projectId,
          title: "New thread",
          modelSelection: hostShell.modelSelection,
          runtimeMode: hostShell.runtimeMode,
          interactionMode: hostShell.interactionMode,
          branch: hostShell.branch,
          worktreePath: hostShell.worktreePath,
        },
      });
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          toastManager.add({
            type: "error",
            title: "Could not start a thread",
            ...(error instanceof Error ? { description: error.message } : {}),
          });
        }
        return false;
      }
      if (!(await waitForThreadShell(scopeThreadRef(host.environmentId, threadId)))) {
        toastManager.add({
          type: "error",
          title: "Could not open the thread",
          description: "The thread was created, but it did not reach this client.",
        });
        return false;
      }
      openThreadTab(host, threadId);
      return true;
    } finally {
      pendingRef.current = false;
    }
  };
  return { available: host !== null, open: useStableCallback(start) };
}
