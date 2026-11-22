import { T, useGT } from "gt-react";
import { usePanelAlwaysFullScreen, useSubagentTabs } from "../../lib/forkPanelTabs";
import { type PanelTabSize, usePanelTabSize } from "../../lib/forkPanelTabSize";
import { useTabHistory } from "../../lib/forkTabHistory";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

const TAB_SIZE_LABELS: Record<PanelTabSize, string> = {
  default: "Upstream",
  large: "Large",
  larger: "Larger",
};

export function PanelTabSettings() {
  const gt = useGT();
  const setting = useSearchableSetting();
  const [subagentTabs, setSubagentTabs] = useSubagentTabs();
  const [fullScreen, setFullScreen] = usePanelAlwaysFullScreen();
  const [tabSize, setTabSize] = usePanelTabSize();
  const [tabHistory, setTabHistory] = useTabHistory();

  return (
    <>
      <SettingsRow
        {...setting("panel-subagent-tabs")}
        description={gt(
          "Open each subagent an agent starts as a tab in its parent thread's right panel. Off by default, as upstream.",
        )}
        resetAction={
          subagentTabs ? (
            <SettingResetButton
              ariaLabel={gt("Reset open subagents as tabs to default")}
              onClick={() => setSubagentTabs(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={subagentTabs}
            onCheckedChange={(checked) => setSubagentTabs(Boolean(checked))}
            aria-label={gt("Open subagents as tabs")}
          />
        }
      />
      <SettingsRow
        {...setting("panel-always-full-screen")}
        description={gt(
          "Open the right panel maximized whenever it shows a tab, with the chat floating over it. With subagent tabs on, a new subagent opens the panel this way with the main chat in view.",
        )}
        resetAction={
          fullScreen ? (
            <SettingResetButton
              ariaLabel={gt("Reset full screen right panel to default")}
              onClick={() => setFullScreen(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={fullScreen}
            onCheckedChange={(checked) => setFullScreen(Boolean(checked))}
            aria-label={gt("Always open the right panel full screen")}
          />
        }
      />
      <SettingsRow
        {...setting("panel-tab-history")}
        description={gt(
          "Back and Forward, including mouse buttons, return to the previous right panel tab or the main chat before switching threads. Off by default, as upstream.",
        )}
        resetAction={
          tabHistory ? (
            <SettingResetButton
              ariaLabel={gt("Reset back and forward through tabs to default")}
              onClick={() => setTabHistory(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={tabHistory}
            onCheckedChange={(checked) => setTabHistory(Boolean(checked))}
            aria-label={gt("Back and Forward through tabs")}
          />
        }
      />
      <SettingsRow
        {...setting("panel-tab-size")}
        description={gt("Height and text size of the tabs along the top of the right panel.")}
        resetAction={
          tabSize !== "default" ? (
            <SettingResetButton
              ariaLabel={gt("Reset panel tab size to default")}
              onClick={() => setTabSize("default")}
            />
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
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label={gt("Panel tab size")}>
                <SelectValue>{TAB_SIZE_LABELS[tabSize]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="default">
                  <T>Upstream (default)</T>
                </SelectItem>
                <SelectItem value="large">
                  <T>Large</T>
                </SelectItem>
                <SelectItem value="larger">
                  <T>Larger</T>
                </SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
    </>
  );
}
