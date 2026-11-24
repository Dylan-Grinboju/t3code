import { msg, useGT } from "gt-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PaperclipIcon, TicketIcon } from "lucide-react";
import { type MouseEvent, type ReactNode, type RefCallback, useRef, useState } from "react";

import { useOpenLink } from "~/browser/useOpenLink";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useOpenPrLink } from "~/lib/openPullRequestLink";

import { useTimelineVisibleTurnItems } from "../../state/entities";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import { toastManager } from "../ui/toast";
import {
  ANCHORED_COPY_TOAST_TIMEOUT_MS,
  showAnchoredCopyErrorToast,
} from "../ui/anchoredCopyToast";
import { threadDetailPullRequestUrlKey } from "./visibleThreadDetailPullRequests";
import { JiraLinkPreview } from "./JiraLinkPreview";
import { collectThreadLinks, type ThreadLink, type ThreadLinkKind } from "./threadLinks";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
} from "./threadDetailsPanelStyles";

const LINK_PAGE_COUNT = 5;

const LINK_ICONS: Record<ThreadLinkKind, typeof TicketIcon> = {
  pull: PullRequestGlyph.pullRequest,
  jira: TicketIcon,
};

interface ThreadLinksPanelProps {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly visiblePullRequests: ReadonlySet<string>;
  readonly pullRequestSlotRef: RefCallback<HTMLDivElement>;
}

/** GitHub pull requests and Jira issues mentioned in the thread, one section each. Hidden while there are none. */
export function ThreadLinksPanel({
  environmentId,
  threadId,
  visiblePullRequests,
  pullRequestSlotRef,
}: ThreadLinksPanelProps) {
  const gt = useGT();
  const threadRef = scopeThreadRef(environmentId, threadId);
  const items = useTimelineVisibleTurnItems(threadRef);
  const links = collectThreadLinks(items);
  const key = `${environmentId}:${threadId}`;
  return (
    <>
      <ThreadLinkGroup
        key={`github:${key}`}
        id="github"
        linkedRows={<div ref={pullRequestSlotRef} className="flex flex-col" />}
        title={gt("Pull requests")}
        threadRef={threadRef}
        links={links.filter((link) => {
          if (link.kind !== "pull") return false;
          const key = threadDetailPullRequestUrlKey(link.url);
          return key === undefined || !visiblePullRequests.has(key);
        })}
      />
      <ThreadLinkGroup
        key={`jira:${key}`}
        id="jira"
        title={gt("Jira")}
        threadRef={threadRef}
        links={links.filter((link) => link.kind === "jira")}
      />
    </>
  );
}

function ThreadLinkGroup(props: {
  readonly id: string;
  readonly title: string;
  readonly threadRef: ScopedThreadRef;
  readonly links: ReadonlyArray<ThreadLink>;
  readonly linkedRows?: ReactNode;
}) {
  const gt = useGT();
  const [visibleCount, setVisibleCount] = useState(LINK_PAGE_COUNT);
  const openLink = useOpenLink(props.threadRef);
  const openPrLink = useOpenPrLink(props.threadRef);
  const open = (link: ThreadLink, event: MouseEvent<HTMLElement>) => {
    if (link.kind === "pull") {
      openPrLink(event, link.url);
      return;
    }
    if (event.button > 1) return;
    event.preventDefault();
    void openLink(link.url, { event }).catch((error: unknown) => {
      console.error(error);
      toastManager.add({ type: "error", title: gt("Unable to open link") });
    });
  };

  if (props.links.length === 0 && !props.linkedRows) return null;
  const hiddenCount = Math.max(0, props.links.length - visibleCount);

  return (
    <ThreadDetailsSection
      headingId={`thread-details-links-${props.id}-heading`}
      title={props.title}
    >
      {props.linkedRows}
      {props.links.length > 0 && (
        <ul className="m-0 list-none p-0">
          {props.links.slice(0, visibleCount).map((link) => {
            const Icon = LINK_ICONS[link.kind];
            const hasPreview = link.kind === "jira" && link.url.startsWith("https://");
            const control = (
              <ThreadDetailsControl
                size="sm"
                variant="ghost"
                part="row"
                type="button"
                className="flex-1"
                title={hasPreview ? undefined : link.url}
                onClick={(event) => open(link, event)}
                onAuxClick={(event) => open(link, event)}
              >
                <Icon aria-hidden className={THREAD_DETAILS_PANEL_ICON_CLASS} />
                <span className={`min-w-0 truncate ${THREAD_DETAILS_PANEL_LABEL_CLASS}`}>
                  {link.label}
                </span>
              </ThreadDetailsControl>
            );
            return (
              <li key={link.url} className="flex items-center gap-0.5">
                <ThreadLinkCopyButton url={link.url} />
                {hasPreview ? (
                  <JiraLinkPreview
                    environmentId={props.threadRef.environmentId}
                    issue={link}
                    href={link.url}
                  >
                    {control}
                  </JiraLinkPreview>
                ) : (
                  control
                )}
              </li>
            );
          })}
        </ul>
      )}
      {props.links.length > LINK_PAGE_COUNT ? (
        <ThreadDetailsControl
          variant="ghost"
          size="sm"
          onClick={() =>
            setVisibleCount(hiddenCount > 0 ? visibleCount + LINK_PAGE_COUNT : LINK_PAGE_COUNT)
          }
          part="row"
          tone="muted"
          className="w-full active:scale-100"
        >
          {hiddenCount > 0 ? (
            <ChevronDownIcon aria-hidden className="size-4 shrink-0" />
          ) : (
            <ChevronUpIcon aria-hidden className="size-4 shrink-0" />
          )}
          {hiddenCount > 0
            ? gt("Show {count} more", { count: Math.min(hiddenCount, LINK_PAGE_COUNT) })
            : gt("Show less")}
        </ThreadDetailsControl>
      ) : null}
    </ThreadDetailsSection>
  );
}

function ThreadLinkCopyButton(props: { readonly url: string }) {
  const gt = useGT();
  const ref = useRef<HTMLButtonElement>(null);
  const { copyToClipboard, isCopied } = useCopyToClipboard<void>({
    target: {
      target: "link",
      unavailableMessage: msg("Clipboard API is unavailable while copying link."),
      failureMessage: msg("Failed to copy link to the clipboard."),
    },
    onError: (error) => showAnchoredCopyErrorToast(ref, error),
    timeout: ANCHORED_COPY_TOAST_TIMEOUT_MS,
  });
  return (
    <ThreadDetailsControl
      ref={ref}
      part="icon"
      variant="ghost"
      tone="muted"
      aria-label={gt("Copy link")}
      title={gt("Copy link")}
      onClick={() => copyToClipboard(props.url, undefined)}
    >
      {isCopied ? (
        <CheckIcon aria-hidden className="size-3.5 text-success" />
      ) : (
        <PaperclipIcon aria-hidden className="size-3.5" />
      )}
    </ThreadDetailsControl>
  );
}
