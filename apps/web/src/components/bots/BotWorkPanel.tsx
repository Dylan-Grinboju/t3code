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
import { botCreatedConversations, botStatus } from "./botPresentation";

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
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
    >
      <span className="truncate">{shell?.title ?? fallbackTitle}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {shell
          ? shell.settledOverride === "settled"
            ? "Done"
            : botStatus(shell).label
          : "Open conversation"}
      </span>
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
    <section aria-label="Bot work" className="max-h-80 overflow-y-auto border-t pt-3">
      <h3 className="text-sm font-medium">Work conversations</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Normal T3 threads you can continue. Showing links from loaded history.
      </p>
      {conversations.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          No work conversations in loaded history.
        </p>
      )}
      {conversations.map(({ threadId, title }) => (
        <WorkConversation
          key={threadId}
          threadRef={scopeThreadRef(threadRef.environmentId, threadId)}
          fallbackTitle={title}
        />
      ))}
      <h3 className="mt-3 text-sm font-medium">Workers and related conversations</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Inspect delegated work here. Background workers stay out of your task list.
      </p>
      <ThreadRelationshipsPanel
        environmentId={threadRef.environmentId}
        threadId={threadRef.threadId}
        showLineage
        showSideChats
        presentation="bot"
      />
      {(projection?.subagents.length ?? 0) === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          No delegated workers in loaded history.
        </p>
      )}
    </section>
  );
}
