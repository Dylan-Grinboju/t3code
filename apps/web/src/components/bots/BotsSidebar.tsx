import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ContextMenuSource, ScopedThreadRef } from "@t3tools/contracts";
import { BotAvatar } from "./BotIdentity";
import type { MouseEvent as ReactMouseEvent } from "react";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { cn } from "../../lib/utils";
import { useUiStateStore } from "../../uiStateStore";
import { resolveThreadLastVisitedAt } from "../Sidebar.logic";
import { ThreadRenameInput } from "../sidebar/SidebarThreadRow";
import { Kbd } from "../ui/kbd";
import { botStatus } from "./botPresentation";

type BotRowProps = {
  activeKey: string | null;
  renamingKey: string | null;
  renamingTitle: string;
  jumpLabelByKey: ReadonlyMap<string, string> | null;
  onOpen: (ref: ScopedThreadRef) => void;
  onContextMenu: (
    ref: ScopedThreadRef,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  onRenameTitleChange: (title: string) => void;
  onCommitRename: (ref: ScopedThreadRef, title: string) => void;
  onCancelRename: () => void;
};

export function BotsSidebar({
  bots,
  ...rowProps
}: BotRowProps & { bots: ReadonlyArray<EnvironmentThreadShell> }) {
  if (bots.length === 0) return null;
  return (
    <nav
      aria-label="Bots"
      className="max-h-[30vh] shrink-0 overflow-y-auto border-b border-sidebar-border pb-2"
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-sidebar-muted-foreground">
        <span>Bots</span>
        <span
          className="rounded-md bg-sidebar-row-hover px-1.5 py-0.5 text-3xs tabular-nums"
          aria-label={`${bots.length} bots`}
        >
          {bots.length}
        </span>
      </div>
      {bots.map((bot) => (
        <BotRow
          key={scopedThreadKey(scopeThreadRef(bot.environmentId, bot.id))}
          bot={bot}
          {...rowProps}
        />
      ))}
    </nav>
  );
}

function BotRow({ bot, ...props }: BotRowProps & { bot: EnvironmentThreadShell }) {
  const ref = scopeThreadRef(bot.environmentId, bot.id);
  const key = scopedThreadKey(ref);
  const localLastVisitedAt = useUiStateStore((state) => state.threadLastVisitedAtById[key]);
  const status = botStatus({
    ...bot,
    lastVisitedAt: resolveThreadLastVisitedAt(bot.lastVisitedAt, localLastVisitedAt) ?? null,
  });
  const jumpLabel = props.jumpLabelByKey?.get(key) ?? null;
  const className = cn(
    "group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-3 text-left hover:bg-sidebar-row-hover focus-visible:outline-2 focus-visible:outline-ring motion-safe:transition-colors",
    props.activeKey === key && "border-primary/15 bg-sidebar-row-active shadow-xs",
  );
  const handleContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    props.onContextMenu(ref, { x: event.clientX, y: event.clientY }, contextMenuSourceOf(event));
  };
  const statusLine = (
    <span className={cn("mt-1 flex items-center gap-1.5 text-2xs", status.colorClass)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">
        {status.needsYou ? "Needs you · " : ""}
        {status.label}
      </span>
    </span>
  );
  if (props.renamingKey === key) {
    return (
      <div className={className}>
        <BotAvatar needsYou={status.needsYou} />
        <span className="min-w-0 flex-1">
          <span className="flex">
            <ThreadRenameInput
              title={props.renamingTitle}
              onTitleChange={props.onRenameTitleChange}
              onCommit={() => props.onCommitRename(ref, props.renamingTitle)}
              onCancel={props.onCancelRename}
            />
          </span>
          {statusLine}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-current={props.activeKey === key ? "page" : undefined}
      onClick={() => props.onOpen(ref)}
      onContextMenu={handleContextMenu}
      className={className}
    >
      <BotAvatar needsYou={status.needsYou} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{bot.title}</span>
        {statusLine}
      </span>
      {jumpLabel ? (
        <Kbd aria-hidden data-jump-hint>
          {jumpLabel}
        </Kbd>
      ) : null}
    </button>
  );
}
