import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { BotIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { botStatus } from "./botPresentation";

export function BotsSidebar({
  bots,
  activeKey,
  onOpen,
}: {
  bots: ReadonlyArray<EnvironmentThreadShell>;
  activeKey: string | null;
  onOpen: (ref: ScopedThreadRef) => void;
}) {
  if (bots.length === 0) return null;
  return (
    <nav
      aria-label="Bots"
      className="max-h-[30vh] shrink-0 overflow-y-auto border-b border-sidebar-border pb-2"
    >
      <div className="px-3 py-2 text-xs font-medium text-sidebar-muted-foreground">Bots</div>
      {bots.map((bot) => {
        const ref = scopeThreadRef(bot.environmentId, bot.id);
        const status = botStatus(bot);
        return (
          <button
            key={scopedThreadKey(ref)}
            type="button"
            aria-current={activeKey === scopedThreadKey(ref) ? "page" : undefined}
            onClick={() => onOpen(ref)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-sidebar-row-hover focus-visible:outline-2 focus-visible:outline-ring",
              activeKey === scopedThreadKey(ref) && "bg-sidebar-row-active",
            )}
          >
            <BotIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{bot.title}</span>
              <span className={cn("block text-xs", status.colorClass)}>
                {status.needsYou ? "Needs you · " : ""}
                {status.label}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
