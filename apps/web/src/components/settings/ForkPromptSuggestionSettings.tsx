import { createModelSelection } from "@t3tools/shared/model";
import { usePromptSuggestionModel } from "../chat/forkPromptSuggestionSettings";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";
import { useSettingsScope } from "./SettingsScopeContext";
import { useEnvironmentProviders, useEnvironments } from "../../state/environments";
import { EnvironmentScopeMenu } from "./SettingsScopeSentence";
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
  const scope = useSettingsScope();
  const { environments } = useEnvironments();
  const environmentId = scope.environment?.environmentId ?? null;
  const settings = useScopedSettings();
  const update = useUpdateScopedSettings();
  const { enabled, nativeClaude } = settings.forkPromptSuggestions;
  const setEnabled = (value: boolean) => update({ forkPromptSuggestions: { enabled: value } });
  const setNative = (value: boolean) => update({ forkPromptSuggestions: { nativeClaude: value } });
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
    <SettingsSection
      id="fork-prompt-suggestions"
      title="Prompt suggestions"
      // The Fork page is device-only, so this section brings its own environment picker.
      headerAction={
        <EnvironmentScopeMenu
          value={scope.search}
          groups={scope.groups}
          environments={environments}
          singleEnvironment={scope.singleEnvironment}
          onChange={scope.selectScope}
        />
      }
    >
      <SettingsRow
        {...searchableSetting("fork-prompt-suggestions")}
        serverScoped
        settingKeys={["forkPromptSuggestions"]}
        description="Predict your next prompt after a reply, in conversations with any model. Press Right Arrow or Tab to accept, then Enter to send. Off by default. Uses additional model usage. Applies to this environment."
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
        {...searchableSetting("fork-native-claude-suggestions")}
        serverScoped
        settingKeys={["forkPromptSuggestions"]}
        description="Use Claude's own suggestions after Claude replies, starting with the next turn. Other providers use your prediction model below. Claude may take a few seconds or skip a suggestion. Off by default."
        resetAction={
          nativeClaude ? (
            <SettingResetButton
              label="native Claude suggestions"
              onClick={() => setNative(false)}
            />
          ) : null
        }
        control={
          <Switch
            aria-label="Native Claude suggestions"
            checked={nativeClaude}
            onCheckedChange={(value) => setNative(Boolean(value))}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("fork-prompt-suggestion-model")}
        description="Choose the model that predicts your next prompt on this environment, independently of the conversation model. Native Claude suggestions are managed by Claude itself. Reset uses the environment's small-task model."
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
