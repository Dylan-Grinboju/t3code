import type { WaitingReview } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useGT } from "gt-react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import type { ComposerBannerStackItem } from "../chat/ComposerBannerStack";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";

export function useWaitingReviewsBanner(
  reviews: ReadonlyArray<WaitingReview> | undefined,
  draftUpdate: (url: string) => void,
): ComposerBannerStackItem | null {
  const gt = useGT();
  const [expanded, setExpanded] = useLocalStorage(
    "t3code.waitingReviewsExpanded",
    false,
    Schema.Boolean,
  );
  if (!reviews?.length) return null;
  const title = gt("Waiting reviews ({count})", { count: reviews.length });
  return {
    id: "waiting-reviews",
    variant: "default",
    icon: <span className="size-1.5 rounded-full bg-warning" />,
    title,
    actions: (
      <Button
        variant="ghost-muted"
        size="icon-xs"
        aria-label={title}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </Button>
    ),
    children: expanded && (
      <ul className="max-h-[min(12rem,25dvh)] overflow-y-auto">
        {reviews.map((review) => (
          <li
            key={review.url}
            className="flex min-w-0 items-center gap-2 border-t border-border/50 py-0.5"
          >
            <Tooltip>
              <TooltipTrigger render={<span className="min-w-0 flex-1 truncate text-xs" />}>
                {review.title}
              </TooltipTrigger>
              <TooltipPopup>{review.url}</TooltipPopup>
            </Tooltip>
            <Button
              variant="ghost-muted"
              size="xs"
              aria-label={gt("Draft an update request for {title}", { title: review.title })}
              onClick={() => draftUpdate(review.url)}
            >
              {gt("Draft")}
            </Button>
          </li>
        ))}
      </ul>
    ),
  };
}
