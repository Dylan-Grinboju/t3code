import { useGT } from "gt-react";
import { useEnvironmentLookups } from "../CommandPaletteLookups";
import { useNewThreadHiddenEnvironments } from "../newThreadEnvironments";
import { Switch } from "../ui/switch";
import { useEnvironments } from "../../state/environments";
import { SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

export function NewThreadMachineSettings() {
  const gt = useGT();
  const setting = useSearchableSetting();
  const { environments } = useEnvironments();
  const { projectEnvironmentLocationById } = useEnvironmentLookups();
  const { hidden, setHidden } = useNewThreadHiddenEnvironments();

  if (environments.length < 2) {
    return (
      <SettingsRow
        {...setting("new-thread-machines")}
        description={gt(
          "Connect another machine to choose which ones the new thread picker lists.",
        )}
      />
    );
  }

  return (
    <>
      <SettingsRow
        {...setting("new-thread-machines")}
        description={gt(
          "Hidden machines' projects stay out of New thread in… until you type a search. Ctrl+Tab in the picker steps through each machine, hidden ones included.",
        )}
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
                aria-label={gt("Show {label} projects in the new thread picker", { label })}
              />
            }
          />
        );
      })}
    </>
  );
}
