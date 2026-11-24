import { useGT } from "gt-react";
import { usePeekFilesByDefault } from "../peek/referencePeek";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

export function PeekFilesByDefaultSetting() {
  const gt = useGT();
  const searchableSetting = useSearchableSetting();
  const setting = searchableSetting("fork-peek-files-by-default");
  const [enabled, setEnabled] = usePeekFilesByDefault();
  return (
    <SettingsRow
      {...setting}
      description={gt(
        "Click a file reference to peek. Shift-click opens the file in the panel. Off by default.",
      )}
      resetAction={
        enabled && (
          <SettingResetButton
            ariaLabel={gt("Reset to default")}
            onClick={() => setEnabled(false)}
          />
        )
      }
      control={<Switch aria-label={setting.title} checked={enabled} onCheckedChange={setEnabled} />}
    />
  );
}
