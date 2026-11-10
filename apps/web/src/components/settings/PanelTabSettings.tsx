import { usePanelAlwaysFullScreen } from "../../lib/forkPanelTabs";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function PanelTabSettings() {
  const [fullScreen, setFullScreen] = usePanelAlwaysFullScreen();

  return (
    <>
      <SettingsRow
        {...searchableSetting("panel-always-full-screen")}
        description="Open the right panel maximized whenever it shows a tab, with the chat floating over it. A subagent an agent starts opens the panel this way with the main chat in view."
        resetAction={
          fullScreen ? (
            <SettingResetButton
              label="full screen right panel"
              onClick={() => setFullScreen(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={fullScreen}
            onCheckedChange={(checked) => setFullScreen(Boolean(checked))}
            aria-label="Always open the right panel full screen"
          />
        }
      />
    </>
  );
}
