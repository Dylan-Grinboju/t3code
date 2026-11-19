import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { MessageId } from "@t3tools/contracts";
import { LinkIcon, TicketIcon } from "lucide-react";
import { use, type MouseEvent } from "react";
import { useOpenLink } from "../../browser/useOpenLink";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { toastManager } from "../ui/toast";
import { AssistantCitationSource } from "./AssistantCitationSource";
import { TaskCardStart } from "./TaskCardStart";
import { classifyThreadLink } from "./threadLinks";
import { TimelineRowCtx, type TimelineRow } from "./timelineRowContext";

export function TaskCardTimelineRow({ row }: { row: Extract<TimelineRow, { kind: "task-card" }> }) {
  const ctx = use(TimelineRowCtx);
  const openLink = useOpenLink(ctx.threadRef);
  const { card } = row;
  const sourceUrl = card.sourceUrl;
  const source = sourceUrl ? classifyThreadLink(sourceUrl) : null;
  const SourceIcon =
    source?.kind === "pull"
      ? PullRequestGlyph.pullRequest
      : source?.kind === "jira"
        ? TicketIcon
        : LinkIcon;

  function openSource(event: MouseEvent<HTMLAnchorElement>) {
    if (!ctx.threadRef || !sourceUrl) return;
    if (source?.kind === "pull") {
      ctx.openPullRequest(event, sourceUrl);
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    void openLink(sourceUrl, { event }).catch(() => {
      toastManager.add({ type: "error", title: "Unable to open task source" });
    });
  }

  return (
    <div className="px-1">
      <AssistantCitationSource
        messageId={MessageId.make(row.id)}
        {...(ctx.threadRef ? { threadRef: ctx.threadRef } : {})}
        itemKey={row.id}
        request={ctx.citationRequest}
        listRef={ctx.listRef}
      >
        <article
          className="min-w-0 select-text rounded-lg border border-border bg-card p-4 text-card-foreground [overflow-wrap:anywhere]"
          data-thread-find-text="true"
        >
          {(sourceUrl || card.question) && (
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              {sourceUrl && (
                <a
                  className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openSource}
                >
                  <SourceIcon aria-hidden className="size-3.5 shrink-0" />
                  {source?.label ?? new URL(sourceUrl).hostname}
                </a>
              )}
              {sourceUrl && card.question && <span aria-hidden>·</span>}
              {card.question && <span>Decision needed</span>}
            </div>
          )}
          <h4 className="text-base leading-snug font-semibold tracking-tight">{card.title}</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{card.summary}</p>
          {card.question && <p className="mt-2 whitespace-pre-wrap text-sm">{card.question}</p>}
          {card.action && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-2.5">
              <p className="min-w-0 flex-1 basis-44 whitespace-pre-wrap text-sm">
                {card.action.instruction}
              </p>
              {ctx.threadRef && (
                <TaskCardStart
                  card={card}
                  threadRef={scopeThreadRef(ctx.threadRef.environmentId, row.sourceThreadId)}
                  itemId={row.itemId}
                />
              )}
            </div>
          )}
        </article>
      </AssistantCitationSource>
    </div>
  );
}
