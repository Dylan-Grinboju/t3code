import { isElectron } from "../../env";
import { ForkPromptSuggestionSettings } from "./ForkPromptSuggestionSettings";
import { useClientSettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import {
  FORK_RELEASE_TAG,
  forkUpdateActionLabel,
  resolveForkUpdateAction,
  runForkUpdateAction,
  useForkReleaseStatus,
  type ForkUpdateAction,
} from "../../lib/forkRelease";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  SettingsUnavailableGroup,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { NewThreadMachineSettings } from "./NewThreadMachineSettings";
import { SidebarDisplaySettings } from "./SidebarDisplaySettings";

const FORK_FEATURES = [
  {
    title: "Next prompt suggestions",
    description:
      "Predict your next message in any model's conversation. Enable Prompt suggestions below and choose a separate prediction model. Right Arrow or Tab accepts the gray suggestion; Enter sends it.",
  },
  {
    title: "Sidebar status strip",
    description:
      "With the sidebar closed, a thin strip of thread status icons can stay along the left edge. Set it under Sidebar below.",
  },
  {
    title: "Hover to reveal the sidebar",
    description:
      "Move the pointer to the left edge of the window and the sidebar slides in over the chat. It hides again when the pointer leaves it.",
  },
  {
    title: "Usage bars",
    description:
      "The sidebar footer shows Codex weekly, Claude session and Claude weekly limits. The bar is what's left (or what's used, set below), the line is where even spending would be, and the arrow says whether you're ahead of it. Hover for a forecast; click to open Usage.",
  },
  {
    title: "Maximized panels keep the chat",
    description:
      "Double-click any right panel tab to maximize it. The chat floats over it as a composer: click the thread title to show or hide the conversation, or click the panel behind it to hide it. The thread also appears as the first tab, to view the chat full size.",
  },
  {
    title: "Machines in the new thread picker",
    description:
      "Hide a connected machine's projects from New thread in… until you type. In the picker, Ctrl+Tab (or the footer button) steps through one machine at a time.",
  },
  {
    title: "Thread links",
    description:
      "Thread details list the GitHub pull requests and Jira issues mentioned in the thread, newest first. Hide them from the card's right-click menu.",
  },
  {
    title: "Shelf and Peek",
    description:
      "The shelf below thread details keeps screenshots and text you pin beside Cite. Select a text pin to return to its source. Pins stay on this device. Shift-click a file or thread reference to peek without leaving your conversation; Escape returns, and Open keeps it open.",
  },
  {
    title: "Fork releases",
    description:
      "Mac and Windows builds come from the fork's own releases. When a newer one is out, the sidebar button and the Release row here download it, then install it and restart T3 Code. A download not installed within 24 hours is removed.",
  },
] as const;

function describeAction(action: ForkUpdateAction | null, checkFailed: boolean) {
  if (action === null)
    return "Development build. Update checks run only in builds from the fork's release workflow.";
  switch (action.kind) {
    case "install":
      return action.busy
        ? `Installing ${action.tag}. T3 Code will restart.`
        : `${action.tag} is downloaded. Install it to restart into it. The download is removed after 24 hours.`;
    case "download":
      return action.busy
        ? `Downloading ${action.release.tag}…`
        : `${action.release.tag} is available.`;
    case "open":
      return `${action.release.tag} is available.`;
    case "check":
      if (action.busy) return "Checking for a newer release…";
      return checkFailed
        ? "Could not reach GitHub to check for a newer release."
        : "You have the latest release.";
  }
}

function SlackLinkTrustSetting() {
  const disabled = !isElectron;
  const trustSlackLinks = useClientSettings((settings) => settings.browserTrustSlackLinks);
  const updateSettings = useUpdatePrimarySettings();

  return (
    <SettingsRow
      {...searchableSetting("browser-trust-slack-links")}
      description="Allow pages in the built-in browser to open the Slack app without asking each time."
      resetAction={
        !disabled && trustSlackLinks ? (
          <SettingResetButton
            label="Slack link trust"
            onClick={() => updateSettings({ browserTrustSlackLinks: false })}
          />
        ) : null
      }
      control={
        <Switch
          disabled={disabled}
          checked={trustSlackLinks}
          onCheckedChange={(checked) =>
            updateSettings({ browserTrustSlackLinks: Boolean(checked) })
          }
          aria-label="Always trust Slack links"
        />
      }
    />
  );
}

export function ForkSettingsPanel() {
  const snapshot = useForkReleaseStatus();
  const action = resolveForkUpdateAction(snapshot);

  return (
    <SettingsPageContainer>
      <SettingsSection id="fork-release" title="Release">
        <SettingsRow
          {...searchableSetting("fork-version")}
          title={
            <span className="inline-flex items-baseline gap-2">
              <span>Version</span>
              <code className="text-2xs font-medium text-muted-foreground">
                {FORK_RELEASE_TAG || "dev"}
              </code>
            </span>
          }
          description={describeAction(action, snapshot.status.kind === "failed")}
          control={
            action === null ? null : (
              <Button
                size="sm"
                variant={action.kind === "check" ? "outline" : "default"}
                disabled={"busy" in action && action.busy}
                onClick={() => runForkUpdateAction(action)}
              >
                {forkUpdateActionLabel(action)}
              </Button>
            )
          }
        />
      </SettingsSection>
      <SettingsSection id="fork-features" title="What this fork adds">
        {FORK_FEATURES.map((feature) => (
          <SettingsRow
            key={feature.title}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </SettingsSection>
      <SettingsSection id="fork-sidebar" title="Sidebar">
        <SidebarDisplaySettings />
      </SettingsSection>
      <ForkPromptSuggestionSettings />
      <SettingsSection id="fork-browser" title="Browser">
        <SettingsUnavailableGroup
          message={!isElectron ? "Only available in the desktop app." : undefined}
        >
          <SlackLinkTrustSetting />
        </SettingsUnavailableGroup>
      </SettingsSection>
      <SettingsSection id="fork-new-thread-machines" title="New thread picker">
        <NewThreadMachineSettings />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
