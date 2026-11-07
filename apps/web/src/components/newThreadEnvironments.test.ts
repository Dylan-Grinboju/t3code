import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId } from "@t3tools/contracts";

import { cycleNewThreadEnvironment, scopeNewThreadPickerEntries } from "./newThreadEnvironments";

const local = EnvironmentId.make("local");
const mac = EnvironmentId.make("mac");

const member = (environmentId: EnvironmentId, name: string) => ({ environmentId, name });
const entry = (...members: ReturnType<typeof member>[]) => ({
  group: { memberProjects: members },
  targetProject: members[0]!,
});

const localOnly = entry(member(local, "t3code"));
const macOnly = entry(member(mac, "scratch"));
const shared = entry(member(mac, "repo@mac"), member(local, "repo@local"));
const entries = [localOnly, macOnly, shared];

const targets = (scoped: ReadonlyArray<(typeof entries)[number]>) =>
  scoped.map((scopedEntry) => scopedEntry.targetProject.name);

describe("scopeNewThreadPickerEntries", () => {
  it.each([
    {
      name: "hides a machine until the user searches",
      scope: { viewing: null, hidden: new Set([mac]), searching: false },
      expected: ["t3code", "repo@local"],
    },
    {
      name: "brings hidden machines back while searching",
      scope: { viewing: null, hidden: new Set([mac]), searching: true },
      expected: ["t3code", "scratch", "repo@mac"],
    },
    {
      name: "shows only the viewed machine, hidden or not, even while searching",
      scope: { viewing: mac, hidden: new Set([mac]), searching: true },
      expected: ["scratch", "repo@mac"],
    },
    {
      name: "retargets a shared project at the viewed machine's copy",
      scope: { viewing: local, hidden: new Set<string>(), searching: false },
      expected: ["t3code", "repo@local"],
    },
  ])("$name", ({ scope, expected }) => {
    expect(targets(scopeNewThreadPickerEntries(entries, scope))).toEqual(expected);
  });
});

describe("cycleNewThreadEnvironment", () => {
  it("steps from all machines through each and wraps both ways", () => {
    const order = [local, mac];
    expect(cycleNewThreadEnvironment(null, order, 1)).toBe(local);
    expect(cycleNewThreadEnvironment(local, order, 1)).toBe(mac);
    expect(cycleNewThreadEnvironment(mac, order, 1)).toBeNull();
    expect(cycleNewThreadEnvironment(null, order, -1)).toBe(mac);
    // A machine that disconnected mid-session falls back into the cycle.
    expect(cycleNewThreadEnvironment(EnvironmentId.make("gone"), order, 1)).toBe(local);
  });
});
