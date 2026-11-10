import { createModelSelection } from "@t3tools/shared/model";
import {
  usePromptSuggestionModel,
  usePromptSuggestionsEnabled,
} from "../chat/forkPromptSuggestionSettings";
import { useScopedSettings } from "./useScopedSettings";
import { useSettingsScope } from "./SettingsScopeContext";
import { useEnvironmentProviders } from "../../state/environments";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { getCustomModelOptionsByInstance } from "../../modelSelection";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { TraitsPicker } from "../chat/TraitsPicker";
import { Switch } from "../ui/switch";
import {
  SETTINGS_PICKER_TRIGGER_CLASSNAME,
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function ForkPromptSuggestionSettings() {
  const [enabled, setEnabled] = usePromptSuggestionsEnabled();
  const { environment } = useSettingsScope();
  const environmentId = environment?.environmentId ?? null;
  const settings = useScopedSettings();
  const [saved, setModel] = usePromptSuggestionModel(environmentId);
  const providersByEnvironment = useEnvironmentProviders();
  const providers = (
    (environmentId === null ? undefined : providersByEnvironment.get(environmentId)) ??
    EMPTY_SERVER_PROVIDERS
  ).filter((provider) => provider.supportsTextGeneration !== false);
  const selection = saved ?? settings.textGenerationModelSelection;
  const entries = providerInstanceEntriesFor(providers, settings, null);
  const entry = entries.find((candidate) => candidate.instanceId === selection.instanceId);
  return (
    <SettingsSection id="fork-prompt-suggestions" title="Prompt suggestions">
      <SettingsRow
        {...searchableSetting("fork-prompt-suggestions")}
        description="Predict your next prompt after a reply, in conversations with any model. Press Right Arrow or Tab to accept, then Enter to send. Off by default. Uses additional model usage. Applies on this device."
        resetAction={
          enabled ? (
            <SettingResetButton label="prompt suggestions" onClick={() => setEnabled(false)} />
          ) : null
        }
        control={
          <Switch
            aria-label="Prompt suggestions"
            checked={enabled}
            onCheckedChange={(value) => setEnabled(Boolean(value))}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("fork-prompt-suggestion-model")}
        description="Choose the model that predicts your next prompt on this environment, independently of the conversation model. Reset uses the environment's small-task model."
        resetAction={
          saved ? (
            <SettingResetButton label="suggestion model" onClick={() => setModel(null)} />
          ) : null
        }
        control={
          environmentId === null ? (
            <span className="text-sm text-muted-foreground">
              Select a connected environment to choose its model.
            </span>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ProviderModelPicker
                environmentId={environmentId}
                activeInstanceId={selection.instanceId}
                model={selection.model}
                lockedProvider={null}
                instanceEntries={entries}
                modelOptionsByInstance={getCustomModelOptionsByInstance(
                  settings,
                  providers,
                  selection.instanceId,
                  selection.model,
                )}
                triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                triggerAriaLabel="Prompt suggestion model"
                getModelDisabledReason={(instanceId) => {
                  const candidate = entries.find((entry) => entry.instanceId === instanceId);
                  return candidate?.enabled && candidate.isAvailable
                    ? null
                    : "This provider is unavailable on this environment.";
                }}
                onInstanceModelChange={(instanceId, model) =>
                  setModel(createModelSelection(instanceId, model))
                }
              />
              {entry ? (
                <TraitsPicker
                  provider={entry.driverKind}
                  models={entry.models}
                  model={selection.model}
                  modelOptions={selection.options ?? []}
                  allowPromptInjectedEffort={false}
                  planModeEnabled={false}
                  triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                  onModelOptionsChange={(options) =>
                    setModel(createModelSelection(selection.instanceId, selection.model, options))
                  }
                />
              ) : null}
            </div>
          )
        }
      />
    </SettingsSection>
  );
}
