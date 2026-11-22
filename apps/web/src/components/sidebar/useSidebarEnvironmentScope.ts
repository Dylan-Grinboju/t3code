import { useGT } from "gt-react";
import { EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";

const EnvironmentScopeId = Schema.NullOr(EnvironmentId);
const ALL_ENVIRONMENTS = {
  kind: "environment" as const,
  value: "environment:all",
  environmentId: null,
};

export function useSidebarEnvironmentScope(labels: ReadonlyMap<EnvironmentId, string>) {
  const gt = useGT();
  const [savedId, setId] = useLocalStorage("fork.sidebarEnvironmentId", null, EnvironmentScopeId);
  const label = savedId === null ? undefined : labels.get(savedId);
  const id = label === undefined ? null : savedId;
  const items =
    labels.size < 2 && id === null
      ? []
      : [
          { ...ALL_ENVIRONMENTS, label: gt("All environments") },
          ...Array.from(labels, ([environmentId, label]) => ({
            kind: "environment" as const,
            value: `environment:id:${environmentId}`,
            label,
            environmentId,
          })),
        ];
  return { id, label, items, setId };
}
