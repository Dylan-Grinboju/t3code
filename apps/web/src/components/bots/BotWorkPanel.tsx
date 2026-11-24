import { T, useGT, useMessages } from "gt-react";
import { ArrowUpRightIcon, MessagesSquareIcon, WorkflowIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Link } from "@tanstack/react-router";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import { isListedThreadLineage, type ScopedThreadRef, type ThreadId } from "@t3tools/contracts";
import {
  useHiddenThreadKeys,
  useQuietThreadProjection,
  useQuietThreadShell,
  useThreadRefs,
} from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { useArchivedThreadSnapshots } from "../../lib/archivedThreadsState";
import { ThreadRelationshipsPanel } from "../chat/ThreadRelationshipsControl";
import { BOT_RELATIONSHIP_LABELS, botCreatedConversations, botStatus } from "./botPresentation";

function WorkConversation({
  threadRef,
  fallbackTitle,
}: {
  threadRef: ScopedThreadRef;
  fallbackTitle: string;
}) {
  const gt = useGT();
  const messages = useMessages();
  const shell = useQuietThreadShell(threadRef);
  if (
    shell?.deletedAt != null ||
    shell?.archivedAt != null ||
    (shell && (shell.delegatedFrom != null || !isListedThreadLineage(shell.lineage)))
  )
    return null;
  return (
    <Link
      to="/$environmentId/$threadId"
      params={buildThreadRouteParams(threadRef)}
      className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm hover:border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring motion-safe:transition-colors"
    >
      <MessagesSquareIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{shell?.title ?? fallbackTitle}</span>
      <span
        className={cn(
          "shrink-0 text-xs",
          shell ? botStatus(shell).colorClass : "text-muted-foreground",
        )}
      >
        {shell
          ? shell.settledOverride === "settled"
            ? gt("Done")
            : messages(botStatus(shell).label)
          : gt("Open conversation")}
      </span>
      <ArrowUpRightIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}

export function BotWorkPanel({ threadRef }: { threadRef: ScopedThreadRef }) {
  const gt = useGT();
  const messages = useMessages();
  const projection = useQuietThreadProjection(threadRef)?.projection ?? null;
  const hidden = useHiddenThreadKeys();
  const refs = useThreadRefs();
  const archiveEnvironments = new Set([threadRef.environmentId]);
  for (const { remoteChild } of projection?.subagents ?? []) {
    if (remoteChild) archiveEnvironments.add(remoteChild.environmentId);
  }
  const { unfilteredSnapshots } = useArchivedThreadSnapshots([...archiveEnvironments]);
  const archivedThreadKeys = new Set(
    unfilteredSnapshots.flatMap(({ environmentId, snapshot }) =>
      snapshot.threads.map(({ id }) => threadKey(scopeThreadRef(environmentId, id))),
    ),
  );
  const listedThreadIds = new Set<ThreadId>();
  for (const ref of refs) {
    archivedThreadKeys.delete(threadKey(ref));
    if (ref.environmentId === threadRef.environmentId) listedThreadIds.add(ref.threadId);
  }
  const conversations = botCreatedConversations(projection, listedThreadIds).filter(
    ({ threadId }) => {
      const key = threadKey(scopeThreadRef(threadRef.environmentId, threadId));
      return !hidden.has(key) && !archivedThreadKeys.has(key);
    },
  );
  return (
    <section
      aria-label={gt("Bot work")}
      className="max-h-[60dvh] overflow-y-auto overscroll-contain p-4"
    >
      {conversations.length > 0 && (
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <MessagesSquareIcon aria-hidden className="size-4 text-primary" />
            <h3 className="text-sm font-medium">
              <T>Conversations to continue</T>
            </h3>
          </div>
          <p className="mb-2 mt-1 text-xs leading-relaxed text-muted-foreground">
            <T>Separate threads opened by this bot for work that needs your involvement.</T>
          </p>
          {conversations.map(({ threadId, title }) => (
            <WorkConversation
              key={threadId}
              threadRef={scopeThreadRef(threadRef.environmentId, threadId)}
              fallbackTitle={title}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <WorkflowIcon aria-hidden className="size-4 text-primary" />
        <h3 className="text-sm font-medium">
          <T>Workers</T>
        </h3>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        <T>
          Background work stays here. Ask the bot to continue important work in a normal
          conversation, including after a worker finishes.
        </T>
      </p>
      <ThreadRelationshipsPanel
        environmentId={threadRef.environmentId}
        threadId={threadRef.threadId}
        omittedThreadKeys={archivedThreadKeys}
        showLineage
        showSideChats
        labels={{
          ...BOT_RELATIONSHIP_LABELS,
          related: messages(BOT_RELATIONSHIP_LABELS.related),
          active: messages(BOT_RELATIONSHIP_LABELS.active),
          previous: messages(BOT_RELATIONSHIP_LABELS.previous),
          lineageTitle: messages(BOT_RELATIONSHIP_LABELS.lineageTitle),
        }}
      />
      {(projection?.subagents.length ?? 0) === 0 && (
        <p className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <T>No delegated workers in loaded history.</T>
        </p>
      )}
    </section>
  );
}
