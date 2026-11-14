import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { SidebarListItem, SidebarListMarker, SidebarSection } from "../Sidebar.logic";
import {
  addGroup,
  arrangeYosiThreadGroups,
  moveThreadsToGroup,
  planYosiGroupDrop,
  removeGroup,
  sortYosiActiveThreads,
  type YosiThreadGroup,
} from "./yosiThreadGroups";

const group = (id: string, threadKeys: string[], collapsed = false): YosiThreadGroup => ({
  id,
  name: id,
  collapsed,
  threadKeys,
});
const row = (key: string, section: SidebarSection = "active"): SidebarListItem => ({
  kind: "thread",
  key,
  section,
});
const marker = (name: SidebarListMarker): SidebarListItem => ({ kind: "marker", marker: name });

describe("thread group membership", () => {
  it("keeps a thread in one group at most", () => {
    const groups = [group("g1", ["a", "b"]), group("g2", ["c"])];
    expect(moveThreadsToGroup(groups, ["a", "c"], "g2")).toEqual([
      group("g1", ["b"]),
      group("g2", ["c", "a"]),
    ]);
    expect(addGroup(groups, { id: "g3", name: "g3", threadKeys: ["b"] })).toEqual([
      group("g1", ["a"]),
      group("g2", ["c"]),
      group("g3", ["b"]),
    ]);
  });

  it("returns threads to the list when they leave or their group is deleted", () => {
    const groups = [group("g1", ["a", "b"])];
    expect(moveThreadsToGroup(groups, ["a"], null)).toEqual([group("g1", ["b"])]);
    expect(removeGroup(groups, "g1")).toEqual([]);
  });

  it("moves nothing into a group that no longer exists", () => {
    const groups = [group("g1", ["a"])];
    expect(moveThreadsToGroup(groups, ["a"], "gone")).toBe(groups);
  });
});

describe("arrangeYosiThreadGroups", () => {
  const keyOf = (thread: { key: string }) => thread.key;
  const t = (key: string) => ({ key });

  it("puts working members at the bottom of their group and keeps the rest on the Working shelf", () => {
    const arrangement = arrangeYosiThreadGroups({
      groups: [group("g1", ["a", "w"]), group("g2", ["c"])],
      activeThreads: [t("u"), t("a"), t("c")],
      workingThreads: [t("w"), t("x")],
      keyOf,
      routeThreadKey: null,
    });
    expect(arrangement.ungroupedThreads.map(keyOf)).toEqual(["u"]);
    expect(arrangement.ungroupedWorkingThreads.map(keyOf)).toEqual(["x"]);
    expect(
      arrangement.blocks.map((block) => [
        block.marker,
        block.visibleThreads.map(keyOf),
        block.visibleWorkingThreads.map(keyOf),
      ]),
    ).toEqual([
      ["yosi-group:g1", ["a"], ["w"]],
      ["yosi-group:g2", ["c"], []],
    ]);
  });

  it("shows only the open thread of a closed group and counts the rest as hidden", () => {
    const [block] = arrangeYosiThreadGroups({
      groups: [group("g1", ["a", "b", "w"], true)],
      activeThreads: [t("a"), t("b")],
      workingThreads: [t("w")],
      keyOf,
      routeThreadKey: "b",
    }).blocks;
    expect(block!.visibleThreads.map(keyOf)).toEqual(["b"]);
    expect(block!.visibleWorkingThreads).toEqual([]);
    expect(block!.hiddenThreads.map(keyOf)).toEqual(["a", "w"]);
  });
});

describe("sortYosiActiveThreads", () => {
  const thread = (id: string, createdAt: string, activeOrderKey: string | null = null) => ({
    id: ThreadId.make(id),
    environmentId: EnvironmentId.make("env"),
    createdAt,
    unsettledAt: null,
    latestRun: null,
    activeOrderKey,
  });

  it("keeps threads never placed on top, newest first, and placed ones in their dragged order", () => {
    const sorted = sortYosiActiveThreads([
      thread("placed-late", "2026-01-05T00:00:00.000Z", "b"),
      thread("old", "2026-01-01T00:00:00.000Z"),
      thread("placed-early", "2026-01-06T00:00:00.000Z", "a"),
      thread("new", "2026-01-04T00:00:00.000Z"),
    ]);
    expect(sorted.map((candidate) => candidate.id)).toEqual([
      "new",
      "old",
      "placed-early",
      "placed-late",
    ]);
  });
});

describe("planYosiGroupDrop", () => {
  const groups = [group("g1", ["a", "b", "w"]), group("g2", ["c"])];
  const items = [
    marker("pinned-header"),
    marker("pinned-divider"),
    marker("active-placeholder"),
    row("u1"),
    row("u2"),
    marker("yosi-group:g1"),
    row("a"),
    row("b"),
    row("w", "working"),
    marker("yosi-group:g2"),
    row("c"),
    marker("settled-header"),
    marker("settled-placeholder"),
  ];
  const activeOrder = ["u1", "u2", "a", "b", "c"];
  const plan = (activeKey: string, overId: string, plannedGroups = groups, plannedItems = items) =>
    planYosiGroupDrop({
      items: plannedItems,
      activeKey,
      overId,
      groups: plannedGroups,
      activeOrder,
    });

  it("joins the group of the nearest header above the slot, above its working rows", () => {
    expect(plan("u1", "b")).toEqual({
      groupId: "g1",
      membershipChanged: true,
      blockOrder: ["a", "b", "u1"],
      blockCurrentOrder: ["a", "b"],
      heldOrder: ["u2", "a", "b", "u1", "c"],
    });
  });

  it("leaves every group when dropped above the first group header", () => {
    expect(plan("c", "sidebar-marker-yosi-group:g1")).toMatchObject({
      groupId: null,
      membershipChanged: true,
      blockOrder: ["u1", "u2", "c"],
    });
  });

  it("reorders within a group without changing membership", () => {
    expect(plan("b", "a")).toMatchObject({
      groupId: "g1",
      membershipChanged: false,
      blockOrder: ["b", "a"],
      blockCurrentOrder: ["a", "b"],
      heldOrder: ["u1", "u2", "b", "a", "c"],
    });
  });

  it("adds to the end of a closed group, whose rows are hidden", () => {
    const closed = [group("g1", ["a", "b", "w"]), group("g2", ["c"], true)];
    const closedItems = items.filter((item) => !(item.kind === "thread" && item.key === "c"));
    expect(plan("u1", "sidebar-marker-yosi-group:g2", closed, closedItems)).toMatchObject({
      groupId: "g2",
      membershipChanged: true,
      blockOrder: ["c", "u1"],
      heldOrder: ["u2", "a", "b", "c", "u1"],
    });
  });
});
