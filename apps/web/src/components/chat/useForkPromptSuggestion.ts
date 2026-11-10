import { useAtomValue } from "@effect/atom-react";
import { useEffect, useEffectEvent, useState } from "react";
import type { EnvironmentId, ModelSelection, RunId, ThreadId } from "@t3tools/contracts";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { generatePromptSuggestion } from "../../state/forkPromptSuggestions";
import { usePromptSuggestionModel } from "./forkPromptSuggestionSettings";

export function useForkPromptSuggestion(input: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId | null;
  readonly runId: RunId | null;
  readonly eligible: boolean;
  readonly defaultModel: ModelSelection;
  readonly preferences: { readonly enabled: boolean; readonly nativeClaude: boolean };
}) {
  const { enabled, nativeClaude } = input.preferences;
  const [selectedModel] = usePromptSuggestionModel(input.environmentId);
  const allowed = useAtomValue(generatePromptSuggestion.permissionAtom(input.environmentId));
  const [result, setResult] = useState<{ key: string; text: string | null } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const model = selectedModel ?? input.defaultModel;
  const key = JSON.stringify([
    input.environmentId,
    input.threadId,
    input.runId,
    model,
    nativeClaude,
  ]);
  const active = enabled && allowed && input.eligible && dismissed !== key;
  const request = useEffectEvent(() =>
    input.threadId === null || input.runId === null
      ? null
      : runAtomCommand(
          appAtomRegistry,
          generatePromptSuggestion,
          {
            environmentId: input.environmentId,
            input: { threadId: input.threadId, runId: input.runId, modelSelection: model },
          },
          { reportFailure: false, reportDefect: false },
        ),
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- requests a prediction from the environment and ignores results after the composer or turn changes
  useEffect(() => {
    if (!active) return;
    let current = true;
    void request()?.then((response) => {
      if (current)
        setResult({ key, text: response._tag === "Success" ? response.value.suggestion : null });
    });
    return () => {
      current = false;
    };
  }, [active, key]);
  return {
    text: active && result?.key === key ? result.text : null,
    dismiss: () => setDismissed(key),
  };
}
