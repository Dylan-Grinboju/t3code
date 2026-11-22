import { m } from "../../i18n/messages";
import { msg } from "gt-react";
import { Schema } from "effect";
import { create } from "zustand";
import type { ContextMenuItem, ContextMenuSource, LocalApi } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { sortInboxThreadsByReturn } from "@t3tools/client-runtime/state/thread-inbox";
import { sortActiveThreadsByOrderKey } from "@t3tools/client-runtime/state/thread-sort";

import { useLocalStorage, writeLocalStorageValue } from "../../hooks/useLocalStorage";
import {
  sidebarListItemId,
  type SidebarListItem,
  type SidebarListMarker,
  type SidebarSection,
} from "../Sidebar.logic";

const ThreadGroup = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  collapsed: Schema.Boolean,
  threadKeys: Schema.Array(Schema.String),
});
const ThreadGroups = Schema.Array(ThreadGroup);
export type YosiThreadGroup = typeof ThreadGroup.Type;
type Groups = readonly YosiThreadGroup[];

const THREAD_GROUPS_KEY = "t3code:yosi-thread-groups";
const NO_GROUPS: Groups = [];

export function useYosiThreadGroups(): Groups {
  return useLocalStorage(THREAD_GROUPS_KEY, NO_GROUPS, ThreadGroups)[0];
}

function updateGroups(update: (groups: Groups) => Groups) {
  writeLocalStorageValue(THREAD_GROUPS_KEY, update, NO_GROUPS, ThreadGroups);
}

export type YosiGroupMarker = Extract<SidebarListMarker, `yosi-group:${string}`>;

function yosiGroupMarker(groupId: string): YosiGroupMarker {
  return `yosi-group:${groupId}`;
}

export function isYosiGroupMarker(marker: SidebarListMarker): marker is YosiGroupMarker {
  return marker.startsWith("yosi-group:");
}

function groupIdOfMarker(marker: YosiGroupMarker): string {
  return marker.slice("yosi-group:".length);
}

function nextGroupId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function withoutThreads(groups: Groups, threadKeys: ReadonlySet<string>): Groups {
  return groups.map((group) =>
    group.threadKeys.some((key) => threadKeys.has(key))
      ? { ...group, threadKeys: group.threadKeys.filter((key) => !threadKeys.has(key)) }
      : group,
  );
}

export function addGroup(
  groups: Groups,
  group: { readonly id: string; readonly name: string; readonly threadKeys: readonly string[] },
): Groups {
  return [
    ...withoutThreads(groups, new Set(group.threadKeys)),
    { id: group.id, name: group.name, collapsed: false, threadKeys: [...group.threadKeys] },
  ];
}

/** A group the user deleted while its menu was open has nothing to move into, so nothing moves. */
export function moveThreadsToGroup(
  groups: Groups,
  threadKeys: readonly string[],
  groupId: string | null,
): Groups {
  if (groupId !== null && !groups.some((group) => group.id === groupId)) return groups;
  const members = new Set(groups.find((group) => group.id === groupId)?.threadKeys);
  const moving = new Set(threadKeys.filter((key) => !members.has(key)));
  return withoutThreads(groups, moving).map((group) =>
    group.id === groupId ? { ...group, threadKeys: [...group.threadKeys, ...moving] } : group,
  );
}

function renameGroup(groups: Groups, groupId: string, name: string): Groups {
  return groups.map((group) => (group.id === groupId ? { ...group, name } : group));
}

function setGroupCollapsed(groups: Groups, groupId: string, collapsed: boolean): Groups {
  return groups.map((group) => (group.id === groupId ? { ...group, collapsed } : group));
}

export function removeGroup(groups: Groups, groupId: string): Groups {
  return groups.filter((group) => group.id !== groupId);
}

function defaultGroupName(groups: Groups): string {
  const names = new Set(groups.map((group) => group.name));
  let index = groups.length + 1;
  while (names.has(m(msg("Group {index}", { index })))) index += 1;
  return m(msg("Group {index}", { index }));
}

export const useYosiGroupRename = create<{ groupId: string | null }>(() => ({ groupId: null }));

export const yosiThreadGroupActions = {
  create(threadKeys: readonly string[]) {
    const id = nextGroupId();
    updateGroups((groups) => addGroup(groups, { id, name: defaultGroupName(groups), threadKeys }));
    useYosiGroupRename.setState({ groupId: id });
  },
  move(threadKeys: readonly string[], groupId: string | null) {
    updateGroups((groups) => moveThreadsToGroup(groups, threadKeys, groupId));
  },
  rename(groupId: string, name: string) {
    updateGroups((groups) => renameGroup(groups, groupId, name));
  },
  setCollapsed(groupId: string, collapsed: boolean) {
    updateGroups((groups) => setGroupCollapsed(groups, groupId, collapsed));
  },
  remove(groupId: string) {
    updateGroups((groups) => removeGroup(groups, groupId));
  },
};

export function sortYosiActiveThreads<
  T extends Pick<
    EnvironmentThreadShell,
    "id" | "environmentId" | "createdAt" | "unsettledAt" | "latestRun" | "activeOrderKey"
  >,
>(threads: readonly T[], observedReturnAt?: (thread: T) => number | undefined): T[] {
  const unplaced = threads.filter((thread) => thread.activeOrderKey == null);
  const placed = threads.filter((thread) => thread.activeOrderKey != null);
  return [
    ...sortInboxThreadsByReturn(unplaced, observedReturnAt),
    ...sortActiveThreadsByOrderKey(placed),
  ];
}

export interface YosiGroupBlock<T> {
  readonly group: YosiThreadGroup;
  readonly marker: YosiGroupMarker;
  readonly threads: readonly T[];
  readonly workingThreads: readonly T[];
  readonly visibleThreads: readonly T[];
  readonly visibleWorkingThreads: readonly T[];
  readonly hiddenThreads: readonly T[];
}

export interface YosiGroupArrangement<T> {
  readonly ungroupedThreads: readonly T[];
  readonly ungroupedWorkingThreads: readonly T[];
  readonly blocks: readonly YosiGroupBlock<T>[];
}

export function arrangeYosiThreadGroups<T>(input: {
  readonly groups: Groups;
  readonly activeThreads: readonly T[];
  readonly workingThreads: readonly T[];
  readonly keyOf: (thread: T) => string;
  readonly routeThreadKey: string | null;
}): YosiGroupArrangement<T> {
  const { groups, activeThreads, workingThreads, keyOf, routeThreadKey } = input;
  const groupIdByKey = new Map<string, string>();
  for (const group of groups) {
    for (const key of group.threadKeys) groupIdByKey.set(key, group.id);
  }
  const membersOf = (threads: readonly T[], groupId: string) =>
    threads.filter((thread) => groupIdByKey.get(keyOf(thread)) === groupId);
  const isRoute = (thread: T) => keyOf(thread) === routeThreadKey;
  return {
    ungroupedThreads: activeThreads.filter((thread) => !groupIdByKey.has(keyOf(thread))),
    ungroupedWorkingThreads: workingThreads.filter((thread) => !groupIdByKey.has(keyOf(thread))),
    blocks: groups.map((group) => {
      const threads = membersOf(activeThreads, group.id);
      const working = membersOf(workingThreads, group.id);
      return {
        group,
        marker: yosiGroupMarker(group.id),
        threads,
        workingThreads: working,
        visibleThreads: group.collapsed ? threads.filter(isRoute) : threads,
        visibleWorkingThreads: group.collapsed ? working.filter(isRoute) : working,
        hiddenThreads: group.collapsed
          ? [...threads, ...working].filter((thread) => !isRoute(thread))
          : [],
      };
    }),
  };
}

export function yosiGroupListItems<T>(
  arrangement: YosiGroupArrangement<T>,
  keyOf: (thread: T) => string,
): SidebarListItem[] {
  const rows = (threads: readonly T[], section: "active" | "working"): SidebarListItem[] =>
    threads.map((thread) => ({ kind: "thread", key: keyOf(thread), section }));
  return [
    ...rows(arrangement.ungroupedThreads, "active"),
    ...arrangement.blocks.flatMap((block): SidebarListItem[] => [
      { kind: "marker", marker: block.marker },
      ...rows(block.visibleThreads, "active"),
      ...rows(block.visibleWorkingThreads, "working"),
    ]),
  ];
}

export function yosiVisibleThreads<T>(arrangement: YosiGroupArrangement<T>): T[] {
  return [
    ...arrangement.ungroupedThreads,
    ...arrangement.blocks.flatMap((block) => [
      ...block.visibleThreads,
      ...block.visibleWorkingThreads,
    ]),
  ];
}

export function yosiNavigationParents<T>(
  arrangement: YosiGroupArrangement<T>,
  keyOf: (thread: T) => string,
): ReadonlyMap<string, string> {
  return new Map(
    arrangement.blocks.flatMap((block) =>
      [...block.visibleThreads, ...block.visibleWorkingThreads].map(
        (thread) => [keyOf(thread), block.marker] as const,
      ),
    ),
  );
}

export interface YosiGroupDrop {
  readonly groupId: string | null;
  readonly membershipChanged: boolean;
  readonly blockOrder: readonly string[];
  readonly blockCurrentOrder: readonly string[];
  readonly heldOrder: readonly string[];
}

export function planYosiGroupDrop(input: {
  readonly items: readonly SidebarListItem[];
  readonly activeKey: string;
  readonly overId: string;
  readonly groups: Groups;
  readonly activeOrder: readonly string[];
}): YosiGroupDrop | null {
  const { items, activeKey, overId, groups, activeOrder } = input;
  const activeIndex = items.findIndex((item) => sidebarListItemId(item) === activeKey);
  const overIndex = items.findIndex((item) => sidebarListItemId(item) === overId);
  const dragged = items[activeIndex];
  if (activeIndex === -1 || overIndex === -1 || dragged?.kind !== "thread") return null;
  const moved = items.filter((_, index) => index !== activeIndex);
  moved.splice(overIndex, 0, dragged);

  let groupId: string | null = null;
  let blockStart = 0;
  for (let index = overIndex - 1; index >= 0; index -= 1) {
    const item = moved[index]!;
    if (item.kind === "thread") continue;
    if (isYosiGroupMarker(item.marker)) groupId = groupIdOfMarker(item.marker);
    blockStart = index + 1;
    break;
  }
  const groupIdByKey = new Map<string, string>();
  for (const group of groups) {
    for (const key of group.threadKeys) groupIdByKey.set(key, group.id);
  }
  const inBlock = (key: string) => (groupIdByKey.get(key) ?? null) === groupId;
  const blockCurrentOrder = activeOrder.filter(inBlock);
  const collapsed = groups.find((group) => group.id === groupId)?.collapsed === true;
  const blockOrder: string[] = [];
  if (collapsed) {
    blockOrder.push(...blockCurrentOrder.filter((key) => key !== activeKey), activeKey);
  } else {
    for (const item of moved.slice(blockStart)) {
      if (item.kind === "marker") break;
      // Working rows hold no active order; they sit at the bottom of the group.
      if (item.section !== "working" || item.key === activeKey) blockOrder.push(item.key);
    }
  }

  const heldOrder = activeOrder.filter((key) => key !== activeKey);
  const position = blockOrder.indexOf(activeKey);
  const after = blockOrder.slice(position + 1).find((key) => heldOrder.includes(key));
  const before = blockOrder
    .slice(0, position)
    .toReversed()
    .find((key) => heldOrder.includes(key));
  if (after !== undefined) heldOrder.splice(heldOrder.indexOf(after), 0, activeKey);
  else if (before !== undefined) heldOrder.splice(heldOrder.indexOf(before) + 1, 0, activeKey);
  else heldOrder.push(activeKey);

  return {
    groupId,
    membershipChanged: (groupIdByKey.get(activeKey) ?? null) !== groupId,
    blockOrder,
    blockCurrentOrder,
    heldOrder,
  };
}

const SHELF_HEADERS: ReadonlySet<SidebarListMarker> = new Set([
  "working-header",
  "snoozed-header",
  "settled-header",
]);

export function projectYosiActiveRegion(
  items: readonly SidebarListItem[],
  activeKey: string,
  overId: string,
  targetSection: SidebarSection,
): SidebarListItem[] | null {
  if (!items.some((item) => item.kind === "marker" && isYosiGroupMarker(item.marker))) return null;
  const activeIndex = items.findIndex((item) => sidebarListItemId(item) === activeKey);
  const overIndex = items.findIndex((item) => sidebarListItemId(item) === overId);
  const dragged = items[activeIndex];
  if (dragged?.kind !== "thread") return null;
  const arranged = items.filter((_, index) => index !== activeIndex);
  if (targetSection === "active" && overIndex !== -1) {
    arranged.splice(overIndex, 0, { ...dragged, section: "active" });
  }
  const start = arranged.findIndex(
    (item) => item.kind === "marker" && item.marker === "active-placeholder",
  );
  const end = arranged.findIndex(
    (item, index) => index > start && item.kind === "marker" && SHELF_HEADERS.has(item.marker),
  );
  return arranged.slice(start + 1, end === -1 ? undefined : end);
}

const MENU_PREFIX = "yosi-group:";
type YosiMenuId = `yosi-group:${string}`;

export function isYosiMenuId(id: string): id is YosiMenuId {
  return id.startsWith(MENU_PREFIX);
}

export interface YosiThreadMenu {
  readonly items: ContextMenuItem<YosiMenuId>[];
  readonly threadKeys: readonly string[];
}

export function yosiThreadMenu(input: {
  readonly groups: Groups;
  readonly threadKeys: readonly string[];
  readonly sectionOf: (threadKey: string) => SidebarSection | undefined;
}): YosiThreadMenu | null {
  const threadKeys = input.threadKeys.filter((key) => {
    const section = input.sectionOf(key);
    return section === "active" || section === "working";
  });
  if (threadKeys.length === 0) return null;
  return { items: yosiThreadMenuItems({ groups: input.groups, threadKeys }), threadKeys };
}

export function yosiContextMenu(
  api: Pick<LocalApi, "contextMenu">,
  menu: YosiThreadMenu | null,
  beforeId: string,
) {
  return <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
    source?: ContextMenuSource,
  ) => {
    if (menu === null) return api.contextMenu.show(items, position, source);
    const index = items.findIndex((item) => item.id === beforeId);
    return api.contextMenu.show<T | YosiMenuId>(
      index === -1
        ? [...items, ...menu.items]
        : [...items.slice(0, index), ...menu.items, ...items.slice(index)],
      position,
      source,
    );
  };
}

function yosiThreadMenuItems(input: {
  readonly groups: Groups;
  readonly threadKeys: readonly string[];
}): ContextMenuItem<YosiMenuId>[] {
  const { groups, threadKeys } = input;
  const groupIds = new Set(
    groups
      .filter((group) => threadKeys.some((key) => group.threadKeys.includes(key)))
      .map((group) => group.id),
  );
  const count = threadKeys.length;
  return [
    {
      id: "yosi-group:menu",
      label: count > 1 ? m(msg("Move to group ({count})", { count })) : m(msg("Move to group")),
      icon: "folder",
      separatorBefore: true,
      children: [
        ...groups.map((group) => ({
          id: `yosi-group:move:${group.id}` as const,
          label: group.name,
          checked: groupIds.size === 1 && groupIds.has(group.id),
        })),
        {
          id: "yosi-group:new",
          label: m(msg("New group")),
          icon: "folder-plus",
          separatorBefore: groups.length > 0,
        },
      ],
    },
    ...(groupIds.size > 0
      ? [
          {
            id: "yosi-group:remove" as const,
            label:
              count > 1
                ? m(msg("Remove from group ({count})", { count }))
                : m(msg("Remove from group")),
          },
        ]
      : []),
  ];
}

export function runYosiThreadMenuAction(id: YosiMenuId, threadKeys: readonly string[]) {
  if (id === "yosi-group:new") yosiThreadGroupActions.create(threadKeys);
  else if (id === "yosi-group:remove") yosiThreadGroupActions.move(threadKeys, null);
  else if (id.startsWith("yosi-group:move:")) {
    yosiThreadGroupActions.move(threadKeys, id.slice("yosi-group:move:".length));
  }
}
