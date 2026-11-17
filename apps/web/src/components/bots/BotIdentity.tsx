import { BotIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { botStatus } from "./botPresentation";

export function BotAvatar({
  needsYou = false,
  compact = false,
}: {
  needsYou?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-xs",
        compact ? "size-6 rounded-md" : "size-9 rounded-xl",
        needsYou && "border-warning/25 from-warning/15 to-warning/5 text-warning-foreground",
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
