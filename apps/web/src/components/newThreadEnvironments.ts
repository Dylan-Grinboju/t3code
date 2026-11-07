import type { EnvironmentId } from "@t3tools/contracts";
import { Schema } from "effect";

import { useLocalStorage } from "../hooks/useLocalStorage";

const HIDDEN_ENVIRONMENTS_KEY = "t3code:new-thread-hidden-environments";
const HiddenEnvironmentIds = Schema.Array(Schema.String);
const NO_HIDDEN_ENVIRONMENTS: readonly string[] = [];

/** Machines whose projects the new-thread picker leaves out until the user types. */
export function useNewThreadHiddenEnvironments() {
  const [hiddenIds, setHiddenIds] = useLocalStorage(
    HIDDEN_ENVIRONMENTS_KEY,
    NO_HIDDEN_ENVIRONMENTS,
    HiddenEnvironmentIds,
  );
  const hidden: ReadonlySet<string> = new Set(hiddenIds);
  const setHidden = (environmentId: EnvironmentId, isHidden: boolean) =>
    setHiddenIds((current) =>
      isHidden
        ? [...current.filter((id) => id !== environmentId), environmentId]
        : current.filter((id) => id !== environmentId),
    );
  return { hidden, setHidden };
}

export interface NewThreadEnvironmentScope {
  /** The machine picked with Ctrl+Tab; null shows every machine that is not hidden. */
  readonly viewing: EnvironmentId | null;
  readonly hidden: ReadonlySet<string>;
  /** A typed query brings hidden machines back. */
  readonly searching: boolean;
}

export function isNewThreadEnvironmentShown(
  environmentId: EnvironmentId,
  scope: NewThreadEnvironmentScope,
): boolean {
  if (scope.viewing !== null) return environmentId === scope.viewing;
  return scope.searching || !scope.hidden.has(environmentId);
}

interface ScopedEntry<P extends { readonly environmentId: EnvironmentId }> {
  readonly group: { readonly memberProjects: readonly P[] };
  readonly targetProject: P;
}

/** Drops projects with no copy on a shown machine and retargets the rest at a shown copy. */
export function scopeNewThreadPickerEntries<
  P extends { readonly environmentId: EnvironmentId },
  E extends ScopedEntry<P>,
>(entries: readonly E[], scope: NewThreadEnvironmentScope): readonly E[] {
  if (scope.viewing === null && (scope.searching || scope.hidden.size === 0)) return entries;
  return entries.flatMap((entry) => {
    if (isNewThreadEnvironmentShown(entry.targetProject.environmentId, scope)) return [entry];
    const targetProject = entry.group.memberProjects.find((member) =>
      isNewThreadEnvironmentShown(member.environmentId, scope),
    );
    return targetProject ? [{ ...entry, targetProject }] : [];
  });
}

/** Ctrl+Tab steps from all machines through each one and back to all. */
export function cycleNewThreadEnvironment(
  current: EnvironmentId | null,
  environmentIds: readonly EnvironmentId[],
  direction: 1 | -1,
): EnvironmentId | null {
  const order = [null, ...environmentIds];
  const index = Math.max(0, order.indexOf(current));
  return order[(index + direction + order.length) % order.length] ?? null;
}
