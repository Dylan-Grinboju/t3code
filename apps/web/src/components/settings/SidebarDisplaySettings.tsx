import { T, useGT } from "gt-react";
import { useHideSidebarIssues, useHideSidebarPullRequests } from "../../lib/forkSidebarIcons";
import { useUsageBarsMeasure } from "../sidebar/SidebarUsageBars";
import { useSidebar } from "../ui/sidebar";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

const SIDEBAR_MODE_LABELS = {
  expanded: "Open",
  strip: "Status strip",
  closed: "Closed",
} as const;

export function SidebarDisplaySettings() {
  const gt = useGT();
  const setting = useSearchableSetting();
  const { displayMode, setDisplayMode, hoverEnabled, setHoverEnabled } = useSidebar();
  const [usageBarsMeasure, setUsageBarsMeasure] = useUsageBarsMeasure();
  const [hidePullRequests, setHidePullRequests] = useHideSidebarPullRequests();
  const [hideIssues, setHideIssues] = useHideSidebarIssues();
  const pullRequestsSetting = setting("hide-sidebar-pull-requests");
  const issuesSetting = setting("hide-sidebar-issues");
  const iconVisibilityDescription = gt("The icon is shown by default when supported.");

  return (
    <>
      <SettingsRow
        {...setting("sidebar-display-mode")}
        description={gt(
          "Choose what the thread sidebar shows when it is not open: nothing, or a strip of thread status icons.",
        )}
        resetAction={
          displayMode !== "expanded" ? (
            <SettingResetButton
              ariaLabel={gt("Reset sidebar to default")}
              onClick={() => setDisplayMode("expanded")}
            />
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
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label={gt("Sidebar")}>
                <SelectValue>{SIDEBAR_MODE_LABELS[displayMode]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="expanded">
                  <T>Open (default)</T>
                </SelectItem>
                <SelectItem value="strip">
                  <T>Status strip</T>
                </SelectItem>
                <SelectItem value="closed">
                  <T>Closed</T>
                </SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
      <SettingsRow
        {...setting("sidebar-hover-reveal")}
        description={gt(
          "Show the sidebar over the chat while the pointer is at the left edge of the window.",
        )}
        resetAction={
          hoverEnabled ? (
            <SettingResetButton
              ariaLabel={gt("Reset hover reveal to default")}
              onClick={() => setHoverEnabled(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={hoverEnabled}
            onCheckedChange={(checked) => setHoverEnabled(Boolean(checked))}
            aria-label={gt("Reveal sidebar on left-edge hover")}
          />
        }
      />
      <SettingsRow
        {...pullRequestsSetting}
        description={iconVisibilityDescription}
        resetAction={
          hidePullRequests ? (
            <SettingResetButton
              ariaLabel={gt("Reset Pull requests sidebar icon to default")}
              onClick={() => setHidePullRequests(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={hidePullRequests}
            onCheckedChange={setHidePullRequests}
            aria-label={pullRequestsSetting.title}
          />
        }
      />
      <SettingsRow
        {...issuesSetting}
        description={iconVisibilityDescription}
        resetAction={
          hideIssues ? (
            <SettingResetButton
              ariaLabel={gt("Reset Issues sidebar icon to default")}
              onClick={() => setHideIssues(false)}
            />
          ) : null
        }
        control={
          <Switch
            checked={hideIssues}
            onCheckedChange={setHideIssues}
            aria-label={issuesSetting.title}
          />
        }
      />
      <SettingsRow
        {...setting("sidebar-usage-bars")}
        description={gt(
          "Fill the sidebar usage bars with the share of each limit left, or the share used.",
        )}
        resetAction={
          usageBarsMeasure !== "remaining" ? (
            <SettingResetButton
              ariaLabel={gt("Reset usage bars to default")}
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
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label={gt("Usage bars")}>
                <SelectValue>
                  {usageBarsMeasure === "used" ? gt("Used") : gt("Remaining")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="remaining">
                  <T>Remaining (default)</T>
                </SelectItem>
                <SelectItem value="used">
                  <T>Used</T>
                </SelectItem>
              </SelectPopup>
            </Select>
          </div>
        }
      />
    </>
  );
}
