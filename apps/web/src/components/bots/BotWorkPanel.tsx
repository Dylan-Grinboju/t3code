import { ArrowUpRightIcon, MessagesSquareIcon, WorkflowIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Link } from "@tanstack/react-router";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import {
  useHiddenThreadKeys,
  useQuietThreadProjection,
  useQuietThreadShell,
} from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { ThreadRelationshipsPanel } from "../chat/ThreadRelationshipsControl";
import { BOT_RELATIONSHIP_LABELS, botCreatedConversations, botStatus } from "./botPresentation";

function WorkConversation({
  threadRef,
  fallbackTitle,
}: {
  threadRef: ScopedThreadRef;
  fallbackTitle: string;
}) {
  const shell = useQuietThreadShell(threadRef);
  if (shell?.deletedAt != null || shell?.archivedAt != null) return null;
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
            ? "Done"
            : botStatus(shell).label
          : "Open conversation"}
      </span>
      <ArrowUpRightIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}

export function BotWorkPanel({ threadRef }: { threadRef: ScopedThreadRef }) {
  const projection = useQuietThreadProjection(threadRef)?.projection ?? null;
  const hidden = useHiddenThreadKeys();
  const conversations = botCreatedConversations(projection).filter(
    ({ threadId }) =>
      !hidden.has(scopedThreadKey(scopeThreadRef(threadRef.environmentId, threadId))),
  );
  return (
    <section
      aria-label="Bot work"
      className="mt-3 max-h-[40dvh] overflow-y-auto overscroll-contain rounded-xl border bg-background p-4"
    >
      <div className="flex items-center gap-2">
        <MessagesSquareIcon aria-hidden className="size-4 text-primary" />
        <h3 className="text-sm font-medium">Work conversations</h3>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        Normal T3 threads you can continue. Showing links from loaded history.
      </p>
      {conversations.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5">
          <p className="text-xs font-medium">Room for your next move</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When your bot creates a conversation, pick it up here. No conversations in loaded
            history yet.
          </p>
        </div>
      )}
      {conversations.map(({ threadId, title }) => (
        <WorkConversation
          key={threadId}
          threadRef={scopeThreadRef(threadRef.environmentId, threadId)}
          fallbackTitle={title}
        />
      ))}
      <div className="mt-4 flex items-center gap-2 border-t pt-4">
        <WorkflowIcon aria-hidden className="size-4 text-primary" />
        <h3 className="text-sm font-medium">Workers and related conversations</h3>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        Inspect delegated work here. Background workers stay out of your task list.
      </p>
      <ThreadRelationshipsPanel
        environmentId={threadRef.environmentId}
        threadId={threadRef.threadId}
        showLineage
        showSideChats
        labels={BOT_RELATIONSHIP_LABELS}
      />
      {(projection?.subagents.length ?? 0) === 0 && (
        <p className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          No delegated workers in loaded history.
        </p>
      )}
    </section>
  );
}
