import { ArrowUpRightIcon, MessagesSquareIcon, WorkflowIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Link } from "@tanstack/react-router";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { isListedThreadLineage, type ScopedThreadRef } from "@t3tools/contracts";
import {
  useEnvironmentThreadRefs,
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
  const refs = useEnvironmentThreadRefs(threadRef.environmentId);
  const conversations = botCreatedConversations(
    projection,
    new Set(refs.map((ref) => ref.threadId)),
  ).filter(
    ({ threadId }) =>
      !hidden.has(scopedThreadKey(scopeThreadRef(threadRef.environmentId, threadId))),
  );
  return (
    <section aria-label="Bot work" className="max-h-[60dvh] overflow-y-auto overscroll-contain p-4">
      {conversations.length > 0 && (
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <MessagesSquareIcon aria-hidden className="size-4 text-primary" />
            <h3 className="text-sm font-medium">Conversations to continue</h3>
          </div>
          <p className="mb-2 mt-1 text-xs leading-relaxed text-muted-foreground">
            Separate threads opened by this bot for work that needs your involvement.
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
        <h3 className="text-sm font-medium">Workers</h3>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        Background work stays here. Ask the bot to continue important work in a normal conversation,
        including after a worker finishes.
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
