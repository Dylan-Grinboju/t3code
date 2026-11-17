import { BotIcon } from "lucide-react";
import type { ThreadBot } from "@t3tools/contracts";
import { cn } from "../../lib/utils";
import { projectIconColorClassName } from "../../projectIconColors";
import type { botStatus } from "./botPresentation";

export function BotAvatar({
  needsYou = false,
  compact = false,
  color,
}: {
  needsYou?: boolean;
  compact?: boolean;
  color?: ThreadBot["iconColor"];
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border bg-gradient-to-br shadow-xs",
        color
          ? cn("border-current/20 from-current/15 to-current/5", projectIconColorClassName(color))
          : "border-primary/20 from-primary/15 to-primary/5 text-primary",
        compact ? "size-6 rounded-md" : "size-9 rounded-xl",
        needsYou && "border-warning/25 from-warning/15 to-warning/5",
        needsYou && !color && "text-warning-foreground",
      )}
    >
      <BotIcon className={compact ? "size-3.5" : "size-4.5"} />
    </span>
  );
}

export function BotStatus({ status }: { status: ReturnType<typeof botStatus> | null }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-current/15 bg-current/5 px-2 py-0.5 text-xs font-medium",
        status?.colorClass ?? "text-muted-foreground",
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">
        {status?.needsYou ? "Needs you · " : ""}
        {status?.label ?? "Loading"}
      </span>
    </span>
  );
}
