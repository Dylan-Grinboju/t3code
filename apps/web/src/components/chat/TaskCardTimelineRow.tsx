import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { replaceThreadLinks } from "@t3tools/shared/threadLinks";
import { MessageId } from "@t3tools/contracts";
import { ChevronDownIcon, ChevronRightIcon, LinkIcon, TicketIcon } from "lucide-react";
import { use, useId, useState, type MouseEvent } from "react";
import { useOpenLink } from "../../browser/useOpenLink";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { AssistantCitationSource } from "./AssistantCitationSource";
import { TaskCardStart } from "./TaskCardStart";
import { classifyThreadLink } from "./threadLinks";
import { TimelineRowCtx, type TimelineRow } from "./timelineRowContext";

export function TaskCardTimelineRow({ row }: { row: Extract<TimelineRow, { kind: "task-card" }> }) {
  const ctx = use(TimelineRowCtx);
  const openLink = useOpenLink(ctx.threadRef);
  const { card } = row;
  const detailsId = useId();
  const citationKey =
    ctx.citationRequest?.citation.messageId === row.id ? ctx.citationRequest.key : null;
  const [expanded, setExpanded] = useState(citationKey !== null);
  const [lastCitation, setLastCitation] = useState(citationKey);
  if (citationKey !== lastCitation) {
    setLastCitation(citationKey);
    if (citationKey) setExpanded(true);
  }
  const headline = card.question ?? card.title;
  const summary = replaceThreadLinks(
    card.summary,
    (_link, label) => label || "related conversation",
  )
    .replace(/\s+Earlier thread(?: for context)?:\s*t3-thread:\/\/\S+\s*$/i, "")
    .replace(/t3-thread:\/\/[^\s<>]+/gi, "related conversation");
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
          className="min-w-0 select-text rounded-md border border-border bg-card px-2 py-1 text-card-foreground"
          data-thread-find-text="true"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost-muted"
              size="icon-xs"
              aria-label={`${expanded ? "Hide" : "Show"} details for ${card.title}`}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDownIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
            </Button>
            <h4
              className={
                expanded
                  ? "min-w-0 flex-1 break-words text-sm font-medium"
                  : "min-w-0 flex-1 truncate text-sm font-medium"
              }
            >
              {headline}
            </h4>
            {card.action && ctx.threadRef && (
              <TaskCardStart
                card={card}
                threadRef={scopeThreadRef(ctx.threadRef.environmentId, row.sourceThreadId)}
                itemId={row.itemId}
              />
            )}
          </div>
          <div
            id={detailsId}
            hidden={!expanded}
            className="space-y-1 pb-1 pl-8 pr-1 [overflow-wrap:anywhere]"
          >
            {card.question && card.title !== headline && (
              <p className="text-xs font-medium">{card.title}</p>
            )}
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
            {sourceUrl && (
              <a
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openSource}
              >
                <SourceIcon aria-hidden className="size-3 shrink-0" />
                {source?.label ?? new URL(sourceUrl).hostname}
              </a>
            )}
          </div>
        </article>
      </AssistantCitationSource>
    </div>
  );
}
