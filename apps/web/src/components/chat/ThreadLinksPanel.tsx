import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { ChevronDown, ChevronUp } from "lucide";
import { TicketIcon } from "lucide-react";
import { useState } from "react";

import { useTimelineVisibleTurnItems } from "../../state/entities";
import { MorphIcon } from "../MorphIcon";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
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
  const items = useTimelineVisibleTurnItems(scopeThreadRef(props.environmentId, props.threadId));
  const links = collectThreadLinks(items);
  const key = `${props.environmentId}:${props.threadId}`;
  return (
    <>
      <ThreadLinkGroup
        key={`github:${key}`}
        id="github"
        title="Pull requests"
        links={links.filter((link) => link.kind === "pull")}
      />
      <ThreadLinkGroup
        key={`jira:${key}`}
        id="jira"
        title="Jira"
        links={links.filter((link) => link.kind === "jira")}
      />
    </>
  );
}

function ThreadLinkGroup(props: {
  readonly id: string;
  readonly title: string;
  readonly links: ReadonlyArray<ThreadLink>;
}) {
  const [visibleCount, setVisibleCount] = useState(LINK_PAGE_COUNT);

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
            <li key={link.url}>
              <ThreadDetailsControl
                size="sm"
                variant="ghost"
                part="row"
                title={link.url}
                render={<a href={link.url} target="_blank" rel="noreferrer" />}
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
          <MorphIcon
            aria-hidden
            className="size-4 shrink-0"
            icon={hiddenCount > 0 ? ChevronDown : ChevronUp}
          />
          {hiddenCount > 0 ? `Show ${Math.min(hiddenCount, LINK_PAGE_COUNT)} more` : "Show less"}
        </ThreadDetailsControl>
      ) : null}
    </ThreadDetailsSection>
  );
}
