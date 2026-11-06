import { useUsageBarsMeasure } from "../sidebar/SidebarUsageBars";
import { useSidebar } from "../ui/sidebar";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const SIDEBAR_MODE_LABELS = {
  expanded: "Open",
  strip: "Status strip",
  closed: "Closed",
} as const;

export function SidebarDisplaySettings() {
  const { displayMode, setDisplayMode, hoverEnabled, setHoverEnabled } = useSidebar();
  const [usageBarsMeasure, setUsageBarsMeasure] = useUsageBarsMeasure();

  return (
    <>
      <SettingsRow
        {...searchableSetting("sidebar-display-mode")}
        description="Choose what the thread sidebar shows when it is not open: nothing, or a strip of thread status icons."
        resetAction={
          displayMode !== "expanded" ? (
            <SettingResetButton label="sidebar" onClick={() => setDisplayMode("expanded")} />
          ) : null
        }
        control={
          <div className="w-full sm:w-40">
            <Select
              value={displayMode}
              onValueChange={(mode) => {
                if (mode === "expanded" || mode === "strip" || mode === "closed")
                  setDisplayMode(mode);
              }}
            >
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Sidebar">
                <SelectValue>{SIDEBAR_MODE_LABELS[displayMode]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="expanded">Open (default)</SelectItem>
                <SelectItem value="strip">Status strip</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-hover-reveal")}
        description="Show the sidebar over the chat while the pointer is at the left edge of the window."
        resetAction={
          hoverEnabled ? (
            <SettingResetButton label="hover reveal" onClick={() => setHoverEnabled(false)} />
          ) : null
        }
        control={
          <Switch
            checked={hoverEnabled}
            onCheckedChange={(checked) => setHoverEnabled(Boolean(checked))}
            aria-label="Reveal sidebar on left-edge hover"
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-usage-bars")}
        description="Fill the sidebar usage bars with the share of each limit left, or the share used."
        resetAction={
          usageBarsMeasure !== "remaining" ? (
            <SettingResetButton
              label="usage bars"
              onClick={() => setUsageBarsMeasure("remaining")}
            />
          ) : null
        }
        control={
          <div className="w-full sm:w-40">
            <Select
              value={usageBarsMeasure}
              onValueChange={(measure) => {
                if (measure === "remaining" || measure === "used") setUsageBarsMeasure(measure);
              }}
            >
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Usage bars">
                <SelectValue>{usageBarsMeasure === "used" ? "Used" : "Remaining"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="remaining">Remaining (default)</SelectItem>
                <SelectItem value="used">Used</SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
    </>
  );
}
