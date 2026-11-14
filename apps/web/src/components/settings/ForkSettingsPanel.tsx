import { isElectron } from "../../env";
import { useClientSettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import {
  FORK_RELEASE_TAG,
  forkUpdateActionLabel,
  resolveForkUpdateAction,
  runForkUpdateAction,
  useForkReleaseStatus,
  type ForkUpdateAction,
} from "../../lib/forkRelease";
import { useTypeToCite } from "../../lib/forkTypeToCite";
import { ensureLocalApi } from "../../localApi";
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
import { AdvancedSettings } from "./AdvancedSettings";
import { NewThreadMachineSettings } from "./NewThreadMachineSettings";
import { PanelTabSettings } from "./PanelTabSettings";
import { SidebarDisplaySettings } from "./SidebarDisplaySettings";

const FORK_REPOSITORY_URL = "https://github.com/Dylan-Grinboju/t3code";

const FORK_FEATURES = [
  {
    title: "Sidebar status strip",
    description:
      "With the sidebar closed, a thin strip of thread status icons can stay along the left edge. Set it under Sidebar above.",
  },
  {
    title: "Hover to reveal the sidebar",
    description:
      "Move the pointer to the left edge of the window and the sidebar slides in over the chat. It hides again when the pointer leaves it.",
  },
  {
    title: "Usage bars",
    description:
      "The sidebar footer shows Codex weekly, Claude session and Claude weekly limits. The bar is what's left (or what's used, set above), the line is where even spending would be, and the number on the right is the bar's percent, amber when you're spending faster than even. Hover for a forecast; click to open Usage.",
  },
  {
    title: "Maximized panels keep the chat",
    description:
      "Double-click any right panel tab to maximize it. The chat floats over it as a composer: click the thread title to grow the conversation out of the text box or fold it back, or click the panel behind it to collapse it. The thread also appears as the first tab, to view the chat full size.",
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
    title: "Full screen right panel",
    description:
      "With Always open the right panel full screen on under Panel tabs above, the right panel opens maximized whenever it shows a tab, and with Open subagents as tabs on, a new subagent opens the panel that way with the main chat in view. Restore panel size un-maximizes it until the panel closes.",
  },
  {
    title: "Panel tab size",
    description:
      "Make the tabs along the top of the right panel taller with larger text. Set it under Panel tabs above.",
  },
  {
    title: "Subagents in other projects",
    description:
      "An agent's delegate_task can start a subagent in another project on the same machine, so it works in that repository and still reports back to the thread that started it.",
  },
  {
    title: "Threads as tabs",
    description:
      "Open threads as right panel tabs beside the main chat: Thread in the panel's + menu (N) starts one in the main thread's checkout, which you can change from the tab while it is empty (New worktree… makes it the main chat, then pick it under Run context), and Open as tab in a sidebar thread's right-click menu opens an existing one, from any project on the same machine. With Open subagents as tabs on under Panel tabs above, subagent threads an agent starts open as tabs of their parent, including ones an agent starts in another project. Subagent tabs close once their threads are archived or deleted. The details button in a tab's title bar opens that thread's own details card (git, automations, lineage, shelf). The arrow on a tab makes it the main chat, and the X beside the main chat's title closes it, putting the next thread tab in its place.",
  },
  {
    title: "Chat tab status",
    description:
      "Thread, subagent and side-chat tabs follow the sidebar status: a green bubble for an unread completion clears when you view the chat. Working, Connecting and Waiting appear as labels; approval and input requests keep their sidebar colors until you respond.",
  },
  {
    title: "Rendered markdown in pull requests",
    description:
      "In a pull request's Code tab, markdown files have a Preview button in their header that shows the file as rendered at the pull request's latest version.",
  },
  {
    title: "Right Arrow accepts prompt suggestions",
    description:
      "When the empty composer shows a suggested prompt, Right Arrow fills it in, the same as Tab.",
  },
  {
    title: "Type to cite",
    description:
      "With Type to cite on under Chat above, select text in a response and start typing: it cites the selection, the same as Cite, and what you type becomes the citation's comment.",
  },
  {
    title: "Fork releases",
    description:
      "Mac and Windows builds come from the fork's own releases. The sidebar's check-for-updates button checks for them, like Check now here. When a newer one is out, the sidebar button and the Release row here download it, then install it and restart T3 Code. A download not installed within 24 hours is removed. If an install fails, the Release row says why and where its log is.",
  },
] as const;

function describeAction(
  action: ForkUpdateAction | null,
  checkFailed: boolean,
  installFailure: string | null,
) {
  if (action === null)
    return "Development build. Update checks run only in builds from the fork's release workflow.";
  switch (action.kind) {
    case "install":
      if (action.busy) return `Installing ${action.tag}. T3 Code will restart.`;
      if (installFailure) return `The last install of ${action.tag} failed. ${installFailure}`;
      return `${action.tag} is downloaded. Install it to restart into it. The download is removed after 24 hours.`;
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

function TypeToCiteSetting() {
  const [typeToCite, setTypeToCite] = useTypeToCite();

  return (
    <SettingsRow
      {...searchableSetting("fork-type-to-cite")}
      description="Typing while text in a response is selected cites it and starts its comment, as if you pressed Cite. Off by default, as upstream."
      resetAction={
        typeToCite ? (
          <SettingResetButton label="type to cite" onClick={() => setTypeToCite(false)} />
        ) : null
      }
      control={
        <Switch
          checked={typeToCite}
          onCheckedChange={(checked) => setTypeToCite(Boolean(checked))}
          aria-label="Type to cite"
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
          description={describeAction(
            action,
            snapshot.status.kind === "failed",
            snapshot.local?.message ?? null,
          )}
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
        <SettingsRow
          {...searchableSetting("fork-repository")}
          title="Repository"
          description="Dylan-Grinboju/t3code on GitHub: source, issues and releases."
          control={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void ensureLocalApi().shell.openExternal(FORK_REPOSITORY_URL)}
            >
              Open on GitHub
            </Button>
          }
        />
      </SettingsSection>
      <SettingsSection id="fork-sidebar" title="Sidebar">
        <SidebarDisplaySettings />
      </SettingsSection>
      <SettingsSection id="fork-panel-tabs" title="Panel tabs">
        <PanelTabSettings />
      </SettingsSection>
      <SettingsSection id="fork-chat" title="Chat">
        <TypeToCiteSetting />
      </SettingsSection>
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
      <SettingsSection id="fork-features" title="About the fork" hideTitle>
        <AdvancedSettings label="About the fork" targetIds={[]}>
          {FORK_FEATURES.map((feature) => (
            <SettingsRow
              key={feature.title}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </AdvancedSettings>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
