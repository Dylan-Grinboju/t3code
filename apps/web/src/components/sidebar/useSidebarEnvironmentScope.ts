import { EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";

const EnvironmentScopeId = Schema.NullOr(EnvironmentId);
const ALL_ENVIRONMENTS = {
  kind: "environment" as const,
  value: "environment:all",
  label: "All environments",
  environmentId: null,
};

export function useSidebarEnvironmentScope(labels: ReadonlyMap<EnvironmentId, string>) {
  const [savedId, setId] = useLocalStorage("fork.sidebarEnvironmentId", null, EnvironmentScopeId);
  const label = savedId === null ? undefined : labels.get(savedId);
  const id = label === undefined ? null : savedId;
  const items =
    labels.size < 2 && id === null
      ? []
      : [
          ALL_ENVIRONMENTS,
          ...Array.from(labels, ([environmentId, label]) => ({
            kind: "environment" as const,
            value: `environment:id:${environmentId}`,
            label,
            environmentId,
          })),
        ];
  return { id, label, items, setId };
}
