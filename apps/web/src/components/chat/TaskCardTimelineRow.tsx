import { useGT } from "gt-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { replaceThreadLinks } from "@t3tools/shared/threadLinks";
import { MessageId } from "@t3tools/contracts";
import { ChevronRightIcon } from "lucide-react";
import { use, useId, useState } from "react";
import { cn } from "../../lib/utils";
import { AssistantCitationSource } from "./AssistantCitationSource";
import { findRevealRef } from "./markdownFindContext";
import { TaskCardLinks } from "./TaskCardLinks";
import { TaskCardReply } from "./TaskCardReply";
import { TaskCardStart } from "./TaskCardStart";
import { collectTaskCardLinks } from "./threadLinks";
import { TimelineRowCtx, type TimelineRow } from "./timelineRowContext";

export function TaskCardTimelineRow({ row }: { row: Extract<TimelineRow, { kind: "task-card" }> }) {
  const gt = useGT();
  const ctx = use(TimelineRowCtx);
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
  const links = collectTaskCardLinks(card.sourceUrl, headline, card.title, summary);

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
          className="relative min-w-0 select-text rounded-md border border-border bg-card px-2 py-1 text-card-foreground"
          data-thread-find-text="true"
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="group flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-md hover:text-foreground focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring sm:size-6"
              aria-label={
                expanded
                  ? gt("Hide details for {title}", { title: card.title })
                  : gt("Show details for {title}", { title: card.title })
              }
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((open) => !open)}
            >
              <ChevronRightIcon
                aria-hidden
                className="size-4 group-aria-expanded:rotate-90 motion-safe:transition-transform duration-0 [[data-panel-animations=true]_&]:duration-(--panel-animation-duration) motion-safe:ease-out sm:size-3.5"
              />
            </button>
            <h4
              className={cn(
                "pointer-events-none relative min-w-0 flex-1 text-sm font-medium",
                expanded ? "break-words" : "truncate",
              )}
            >
              <span className="pointer-events-auto">{headline}</span>
            </h4>
            {card.question && (row.answer || (ctx.canOperateThread && ctx.onSendAppMessage)) && (
              <span className="max-w-32 truncate text-xs text-muted-foreground">
                {row.answer ? gt("Answered · {answer}", { answer: row.answer }) : gt("Reply")}
              </span>
            )}
            {card.action && ctx.threadRef && (
              <div className="relative">
                <TaskCardStart
                  card={card}
                  threadRef={scopeThreadRef(ctx.threadRef.environmentId, row.sourceThreadId)}
                  itemId={row.itemId}
                />
              </div>
            )}
          </div>
          <div
            id={detailsId}
            ref={findRevealRef(() => setExpanded(true))}
            data-thread-find-fold={!expanded ? "" : undefined}
            inert={!expanded}
            aria-hidden={!expanded}
            className={cn(
              "pointer-events-none relative grid motion-safe:transition-[grid-template-rows,opacity,visibility] duration-0 [[data-panel-animations=true]_&]:duration-(--panel-animation-duration) motion-safe:ease-out",
              expanded
                ? "grid-rows-[1fr] opacity-100"
                : "invisible grid-rows-[0fr] select-none opacity-0",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-1 pb-1 pl-8 pr-1 [overflow-wrap:anywhere]">
                {card.question && card.title !== headline && (
                  <p className="text-xs font-medium">
                    <span className="pointer-events-auto">{card.title}</span>
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  <span className="pointer-events-auto">{summary}</span>
                </p>
                {row.answer && (
                  <p className="text-xs">{gt("You answered · {answer}", { answer: row.answer })}</p>
                )}
                {!row.answer &&
                  card.question &&
                  ctx.threadRef &&
                  ctx.canOperateThread &&
                  ctx.onSendAppMessage && (
                    <TaskCardReply
                      key={row.id}
                      row={row}
                      threadRef={ctx.threadRef}
                      send={ctx.onSendAppMessage}
                    />
                  )}
                {links.length > 0 && <TaskCardLinks links={links} expanded={expanded} />}
              </div>
            </div>
          </div>
        </article>
      </AssistantCitationSource>
    </div>
  );
}
