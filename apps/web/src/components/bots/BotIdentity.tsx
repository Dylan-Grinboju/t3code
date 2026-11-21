import {
  BotIcon,
  createLucideIcon,
  InboxIcon,
  RocketIcon,
  WrenchIcon,
  CompassIcon,
} from "lucide-react";
import type { ThreadBot } from "@t3tools/contracts";
import { cn } from "../../lib/utils";
import { projectIconColorClassName } from "../../projectIconColors";
import type { botStatus } from "./botPresentation";

export const botGlyphs = {
  lighthouse: createLucideIcon("Lighthouse", [
    [
      "path",
      {
        d: "m8 7 4-4 4 4ZM9 7v4h6V7M7 21l2-10h6l2 10M5 21h14M8 16l8-2M3 7l2 1M21 7l-2 1",
        key: "tower",
      },
    ],
  ]),
  inbox: InboxIcon,
  owl: createLucideIcon("Owl", [
    ["path", { d: "M4 3l5 3a9 9 0 0 1 6 0l5-3v9c0 5-3 9-8 9s-8-4-8-9Z", key: "body" }],
    ["circle", { cx: "8.5", cy: "11", r: "2", key: "left" }],
    ["circle", { cx: "15.5", cy: "11", r: "2", key: "right" }],
    ["path", { d: "m10.5 14 1.5 2 1.5-2", key: "beak" }],
  ]),
  rocket: RocketIcon,
  wrench: WrenchIcon,
  compass: CompassIcon,
} satisfies Record<NonNullable<ThreadBot["glyph"]>, typeof BotIcon>;

export function BotAvatar({
  needsYou = false,
  compact = false,
  color,
  glyph,
}: {
  needsYou?: boolean;
  compact?: boolean;
  glyph?: ThreadBot["glyph"];
  color?: ThreadBot["iconColor"];
}) {
  const Icon = glyph ? botGlyphs[glyph] : BotIcon;
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
      <Icon className={compact ? "size-3.5" : "size-4.5"} />
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
