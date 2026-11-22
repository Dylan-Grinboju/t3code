import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { type EnvironmentId, WS_METHODS } from "@t3tools/contracts";
import {
  BookmarkIcon,
  BugIcon,
  CheckSquare2Icon,
  TicketIcon,
  UserRoundIcon,
  ZapIcon,
} from "lucide-react";
import { type ReactElement, useState } from "react";

import { connectionAtomRuntime } from "~/connection/runtime";
import { useEnvironmentQuery } from "~/state/query";

import { RelativeTime } from "../RelativeTime";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../ui/preview-card";
import type { ThreadLink } from "./threadLinks";

const jiraPreview = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:jira:preview",
  tag: WS_METHODS.jiraPreview,
  staleTimeMs: 60_000,
  idleTtlMs: 300_000,
});

const issueIcons: Readonly<Record<string, typeof TicketIcon>> = {
  bug: BugIcon,
  story: BookmarkIcon,
  epic: ZapIcon,
  task: CheckSquare2Icon,
};

const statusColors = new Map([
  ["done", "border-success bg-success"],
  ["indeterminate", "border-info bg-linear-to-r from-info from-50% to-transparent to-50%"],
]);

export function JiraLinkPreview({
  environmentId,
  issue,
  href,
  children,
  prefetch = false,
}: {
  environmentId: EnvironmentId;
  issue: ThreadLink;
  href: string;
  children: ReactElement;
  prefetch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const preview = useEnvironmentQuery(
    prefetch || hovered || focused || open
      ? jiraPreview({
          environmentId,
          input: { origin: new URL(issue.url).origin, key: issue.label },
        })
      : null,
  );
  const card = preview.data;
  const issueType = card?.issueType.toLowerCase() ?? "";
  const Icon = Object.hasOwn(issueIcons, issueType) ? issueIcons[issueType]! : TicketIcon;
  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        render={children}
        delay={350}
        closeDelay={120}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <PreviewCardPopup align="center" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Icon
              aria-label={card?.issueType ?? "Jira issue"}
              className="size-3 shrink-0 text-info"
            />
            <span className="shrink-0">{issue.label}</span>
            {card && (
              <>
                <span aria-hidden>·</span>
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full border ${statusColors.get(card.statusCategory) ?? "border-muted-foreground"}`}
                />
                <span className="truncate">{card.status}</span>
              </>
            )}
          </div>
          {card ? (
            <>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground text-pretty">
                {card.summary}
              </p>
              <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="inline-grid size-4 shrink-0 place-items-center rounded-full bg-muted text-2xs"
                >
                  {card.assignee?.trim().charAt(0) || <UserRoundIcon className="size-3" />}
                </span>
                <span className="truncate">{card.assignee ?? "Unassigned"}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">
                  updated <RelativeTime timestamp={card.updatedAt} />
                </span>
              </div>
            </>
          ) : (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {preview.isSuccess || preview.error ? href : "Loading issue…"}
            </p>
          )}
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
