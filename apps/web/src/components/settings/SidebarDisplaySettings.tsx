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
    </>
  );
}
