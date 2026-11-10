import * as Schema from "effect/Schema";
import { ModelSelection, type EnvironmentId } from "@t3tools/contracts";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export function usePromptSuggestionsEnabled() {
  return useLocalStorage("fork:prompt-suggestions:enabled", false, Schema.Boolean);
}

const Models = Schema.Record(Schema.String, ModelSelection);
export function usePromptSuggestionModel(environmentId: EnvironmentId | null) {
  const [models, setModels] = useLocalStorage("fork:prompt-suggestions:models", {}, Models);
  return [
    environmentId === null ? null : (models[environmentId] ?? null),
    (model: ModelSelection | null) => {
      if (environmentId === null) return;
      setModels((previous) => {
        const next = { ...previous };
        if (model === null) delete next[environmentId];
        else next[environmentId] = model;
        return next;
      });
    },
  ] as const;
}
