import { LinkIcon, TicketIcon } from "lucide-react";
import { use, type ComponentPropsWithoutRef, type MouseEvent, type ReactElement } from "react";

import { useOpenLink } from "../../browser/useOpenLink";
import {
  useOpenChangeRequestLink,
  usePullRequestPreviewTarget,
} from "../../lib/openPullRequestLink";
import { PullRequestLinkPreview } from "../pullRequest/PullRequestLinkPreview";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { JiraLinkPreview } from "./JiraLinkPreview";
import { type TaskCardLink } from "./threadLinks";
import { TimelineRowCtx } from "./timelineRowContext";

const JIRA_PREFETCH_LIMIT = 3;

function jiraIssueForPreview({ href, preview }: TaskCardLink) {
  return preview?.kind === "jira" && href.startsWith("https://") ? preview : null;
}

export function TaskCardLinks({
  links,
  expanded,
}: {
  links: ReadonlyArray<TaskCardLink>;
  expanded: boolean;
}) {
  const { threadRef, openPullRequest } = use(TimelineRowCtx);
  const openLink = useOpenLink(threadRef);

  function openSource(event: MouseEvent<HTMLAnchorElement>, link: TaskCardLink) {
    if (!threadRef || link.confirmBeforeOpen) return;
    if (link.preview?.kind === "pull") {
      openPullRequest(event, link.href);
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    void openLink(link.href, { event }).catch(() => {
      toastManager.add({ type: "error", title: "Unable to open task source" });
    });
  }

  const jiraPrefetchLinks =
    expanded && threadRef ? links.filter(jiraIssueForPreview).slice(0, JIRA_PREFETCH_LIMIT) : [];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {links.map((link) => {
        const { href, label, preview, confirmBeforeOpen } = link;
        const jiraIssue = jiraIssueForPreview(link);
        const Icon =
          preview?.kind === "jira"
            ? TicketIcon
            : preview?.kind === "pull" && !confirmBeforeOpen
              ? PullRequestGlyph.pullRequest
              : LinkIcon;
        const anchor = (
          <a
            className="pointer-events-auto inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => openSource(event, link)}
          >
            <Icon aria-hidden className="size-3 shrink-0" />
            <span>{label}</span>
          </a>
        );
        return (
          <div key={href} className="flex min-w-0">
            {expanded && threadRef && jiraIssue ? (
              <JiraLinkPreview
                environmentId={threadRef.environmentId}
                issue={jiraIssue}
                href={href}
                prefetch={jiraPrefetchLinks.includes(link)}
              >
                {anchor}
              </JiraLinkPreview>
            ) : expanded && threadRef && preview?.kind === "pull" ? (
              <TaskCardPullRequestLink link={link} candidateUrl={preview.url} anchor={anchor} />
            ) : (
              anchor
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskCardPullRequestLink({
  link,
  candidateUrl,
  anchor,
}: {
  link: TaskCardLink;
  candidateUrl: string;
  anchor: ReactElement<ComponentPropsWithoutRef<"a">>;
}) {
  const { threadRef } = use(TimelineRowCtx);
  const target = usePullRequestPreviewTarget(threadRef?.environmentId ?? null, candidateUrl);
  const openChangeRequest = useOpenChangeRequestLink(threadRef ?? undefined);
  const openLink = useOpenLink(threadRef);

  if (target === null) {
    return (
      <Tooltip>
        <TooltipTrigger render={anchor} />
        <TooltipPopup side="top">{link.href}</TooltipPopup>
      </Tooltip>
    );
  }

  return (
    <PullRequestLinkPreview
      link={anchor}
      originalUrl={link.href}
      target={target}
      confirmBeforeOpen={link.confirmBeforeOpen}
      onOpenPullRequest={(url) =>
        openChangeRequest(
          {
            metaKey: false,
            ctrlKey: false,
            preventDefault: () => undefined,
            stopPropagation: () => undefined,
          },
          url,
        )
      }
      onOpenFallback={openLink}
    />
  );
}
