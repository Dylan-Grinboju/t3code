import { useEnvironmentLookups } from "../CommandPaletteLookups";
import { useNewThreadHiddenEnvironments } from "../newThreadEnvironments";
import { Switch } from "../ui/switch";
import { useEnvironments } from "../../state/environments";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function NewThreadMachineSettings() {
  const { environments } = useEnvironments();
  const { projectEnvironmentLocationById } = useEnvironmentLookups();
  const { hidden, setHidden } = useNewThreadHiddenEnvironments();

  if (environments.length < 2) {
    return (
      <SettingsRow
        {...searchableSetting("new-thread-machines")}
        description="Connect another machine to choose which ones the new thread picker lists."
      />
    );
  }

  return (
    <>
      <SettingsRow
        {...searchableSetting("new-thread-machines")}
        description="Hidden machines' projects stay out of New thread in… until you type a search. Ctrl+Tab in the picker steps through each machine, hidden ones included."
      />
      {environments.map((environment) => {
        const label =
          projectEnvironmentLocationById.get(environment.environmentId)?.label ?? environment.label;
        return (
          <SettingsRow
            key={environment.environmentId}
            title={label}
            control={
              <Switch
                checked={!hidden.has(environment.environmentId)}
                onCheckedChange={(checked) => setHidden(environment.environmentId, !checked)}
                aria-label={`Show ${label} projects in the new thread picker`}
              />
            }
          />
        );
      })}
    </>
  );
}
