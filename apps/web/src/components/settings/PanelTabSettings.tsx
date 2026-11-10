import { usePanelAlwaysFullScreen } from "../../lib/forkPanelTabs";
import { type PanelTabSize, usePanelTabSize } from "../../lib/forkPanelTabSize";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const TAB_SIZE_LABELS: Record<PanelTabSize, string> = {
  default: "Upstream",
  large: "Large",
  larger: "Larger",
};

export function PanelTabSettings() {
  const [fullScreen, setFullScreen] = usePanelAlwaysFullScreen();
  const [tabSize, setTabSize] = usePanelTabSize();

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
      <SettingsRow
        {...searchableSetting("panel-tab-size")}
        description="Height and text size of the tabs along the top of the right panel."
        resetAction={
          tabSize !== "default" ? (
            <SettingResetButton label="panel tab size" onClick={() => setTabSize("default")} />
          ) : null
        }
        control={
          <div className="w-full sm:w-40">
            <Select
              value={tabSize}
              onValueChange={(size) => {
                if (size === "default" || size === "large" || size === "larger") setTabSize(size);
              }}
            >
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Panel tab size">
                <SelectValue>{TAB_SIZE_LABELS[tabSize]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="default">Upstream (default)</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="larger">Larger</SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
    </>
  );
}
