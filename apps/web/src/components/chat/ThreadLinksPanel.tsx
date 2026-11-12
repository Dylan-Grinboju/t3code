import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PaperclipIcon, TicketIcon } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";

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
  showAnchoredCopySuccessToast,
} from "../ui/anchoredCopyToast";
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
}

/** GitHub pull requests and Jira issues mentioned in the thread, one section each. Hidden while there are none. */
export function ThreadLinksPanel(props: ThreadLinksPanelProps) {
  const threadRef = scopeThreadRef(props.environmentId, props.threadId);
  const items = useTimelineVisibleTurnItems(threadRef);
  const links = collectThreadLinks(items);
  const key = `${props.environmentId}:${props.threadId}`;
  return (
    <>
      <ThreadLinkGroup
        key={`github:${key}`}
        id="github"
        title="Pull requests"
        threadRef={threadRef}
        links={links.filter((link) => link.kind === "pull")}
      />
      <ThreadLinkGroup
        key={`jira:${key}`}
        id="jira"
        title="Jira"
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
}) {
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
      toastManager.add({ type: "error", title: "Unable to open link" });
    });
  };

  if (props.links.length === 0) return null;
  const hiddenCount = Math.max(0, props.links.length - visibleCount);

  return (
    <ThreadDetailsSection
      headingId={`thread-details-links-${props.id}-heading`}
      title={props.title}
    >
      <ul className="m-0 list-none p-0">
        {props.links.slice(0, visibleCount).map((link) => {
          const Icon = LINK_ICONS[link.kind];
          return (
            <li key={link.url} className="flex items-center gap-0.5">
              <ThreadLinkCopyButton url={link.url} />
              <ThreadDetailsControl
                size="sm"
                variant="ghost"
                part="row"
                type="button"
                className="flex-1"
                title={link.url}
                onClick={(event) => open(link, event)}
                onAuxClick={(event) => open(link, event)}
              >
                <Icon aria-hidden className={THREAD_DETAILS_PANEL_ICON_CLASS} />
                <span className={`min-w-0 truncate ${THREAD_DETAILS_PANEL_LABEL_CLASS}`}>
                  {link.label}
                </span>
              </ThreadDetailsControl>
            </li>
          );
        })}
      </ul>
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
          {hiddenCount > 0 ? `Show ${Math.min(hiddenCount, LINK_PAGE_COUNT)} more` : "Show less"}
        </ThreadDetailsControl>
      ) : null}
    </ThreadDetailsSection>
  );
}

function ThreadLinkCopyButton(props: { readonly url: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { copyToClipboard, isCopied } = useCopyToClipboard<void>({
    target: "link",
    onCopy: () => showAnchoredCopySuccessToast(ref),
    onError: (error) => showAnchoredCopyErrorToast(ref, error),
    timeout: ANCHORED_COPY_TOAST_TIMEOUT_MS,
  });
  return (
    <ThreadDetailsControl
      ref={ref}
      part="icon"
      variant="ghost"
      tone="muted"
      aria-label="Copy link"
      title="Copy link"
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
