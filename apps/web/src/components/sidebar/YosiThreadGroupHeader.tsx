import { useGT } from "gt-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { ChevronDownIcon, FolderIcon } from "lucide-react";
import { memo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "~/lib/utils";
import { readLocalApi } from "../../localApi";
import { useUiStateStore } from "../../uiStateStore";
import { resolveSidebarFolderDot, resolveThreadLastVisitedAt } from "../Sidebar.logic";
import { SortableSidebarMarker } from "./SidebarListMarkers";
import {
  useYosiGroupRename,
  yosiThreadGroupActions,
  type YosiGroupMarker,
  type YosiThreadGroup,
} from "./yosiThreadGroups";

const GROUP_DOT_CLASS_NAME = {
  attention: "bg-warning",
  failed: "bg-error",
  unread: "bg-success",
  working: "bg-info",
} as const;

function GroupNameInput(props: { name: string; onDone: (name: string | null) => void }) {
  const gt = useGT();
  const [value, setValue] = useState(props.name);
  // Enter and Escape blur the input as it unmounts; that blur must not finish again.
  const doneRef = useRef(false);
  const finish = (name: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    props.onDone(name);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      finish(value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(null);
    }
  };
  return (
    <input
      autoFocus
      value={value}
      dir="auto"
      aria-label={gt("Group name")}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={handleKeyDown}
      onBlur={() => finish(value)}
      onClick={(event) => event.stopPropagation()}
      className="min-w-0 flex-1 rounded-sm border border-input bg-card px-1 text-sm font-medium text-card-foreground outline-none focus:border-foreground"
    />
  );
}

export const YosiThreadGroupHeader = memo(function YosiThreadGroupHeader(props: {
  marker: YosiGroupMarker;
  group: YosiThreadGroup;
  memberCount: number;
  hiddenThreads: readonly EnvironmentThreadShell[];
  dragging: boolean;
}) {
  const gt = useGT();
  const { group, hiddenThreads } = props;
  const renaming = useYosiGroupRename((state) => state.groupId === group.id);
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const dot = group.collapsed
    ? resolveSidebarFolderDot(
        hiddenThreads.map((thread) => ({
          ...thread,
          lastVisitedAt: resolveThreadLastVisitedAt(
            thread.lastVisitedAt,
            localLastVisitedAtById[
              scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))
            ],
          ),
        })),
      )
    : null;
  const finishRename = (name: string | null) => {
    useYosiGroupRename.setState({ groupId: null });
    const trimmed = name?.trim();
    if (trimmed) yosiThreadGroupActions.rename(group.id, trimmed);
  };
  const openMenu = (position: { x: number; y: number }) => {
    const api = readLocalApi();
    if (!api) return;
    void (async () => {
      const clicked = await settlePromise(() =>
        api.contextMenu.show(
          [
            { id: "rename", label: gt("Rename group"), icon: "pencil" },
            { id: "new", label: gt("New group"), icon: "folder-plus" },
            {
              id: "delete",
              label: gt("Delete group"),
              detail: gt("Its threads stay"),
              icon: "trash",
              destructive: true,
              separatorBefore: true,
            },
          ],
          position,
        ),
      );
      if (clicked._tag === "Failure") return;
      switch (clicked.value) {
        case "rename":
          useYosiGroupRename.setState({ groupId: group.id });
          return;
        case "new":
          yosiThreadGroupActions.create([]);
          return;
        case "delete":
          yosiThreadGroupActions.remove(group.id);
          return;
      }
    })();
  };
  return (
    <SortableSidebarMarker
      marker={props.marker}
      data-testid="sidebar-yosi-group"
      className="relative mx-0.5 mt-1"
    >
      {renaming ? (
        <div className="flex h-8 items-center gap-2 px-(--sidebar-row-content-inset)">
          <FolderIcon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
          <GroupNameInput name={group.name} onDone={finishRename} />
        </div>
      ) : (
        <button
          type="button"
          data-sidebar-row={props.marker}
          aria-expanded={!group.collapsed}
          onClick={() => yosiThreadGroupActions.setCollapsed(group.id, !group.collapsed)}
          onContextMenu={(event) => {
            event.preventDefault();
            openMenu({ x: event.clientX, y: event.clientY });
          }}
          className={cn(
            "flex h-8 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            props.dragging && "bg-sidebar-row-hover/60",
          )}
        >
          <FolderIcon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground/90">
            {group.name}
          </span>
          {dot ? (
            <span className={cn("size-1.5 shrink-0 rounded-full", GROUP_DOT_CLASS_NAME[dot])} />
          ) : null}
          <span className="shrink-0 text-xs tabular-nums text-sidebar-muted-foreground">
            {props.memberCount}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-3 shrink-0 text-sidebar-muted-foreground transition-transform",
              group.collapsed && "-rotate-90",
            )}
          />
        </button>
      )}
    </SortableSidebarMarker>
  );
});
