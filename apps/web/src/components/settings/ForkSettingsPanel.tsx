import { ensureLocalApi } from "../../localApi";
import {
  checkForkReleaseNow,
  FORK_RELEASE_TAG,
  newerForkRelease,
  useForkReleaseStatus,
  type ForkReleaseStatus,
} from "../../lib/forkRelease";
import { Button } from "../ui/button";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { SidebarDisplaySettings } from "./SidebarDisplaySettings";

const FORK_FEATURES = [
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
      "The sidebar footer shows Codex weekly, Claude session and Claude weekly limits. The bar is what's left, the line is where even spending would be, and the arrow says whether you're ahead of it. Hover for a forecast; click to open Usage.",
  },
  {
    title: "Maximized panels keep the chat",
    description:
      "Double-click any right panel tab to maximize it. The chat floats over it as a composer: double-click the thread title to show or hide the conversation. The thread also appears as the first tab, to view the chat full size.",
  },
  {
    title: "Fork releases",
    description:
      "Mac and Windows builds come from the fork's own releases. The sidebar shows a button when a newer one is out.",
  },
] as const;

function describeStatus(status: ForkReleaseStatus) {
  const newer = newerForkRelease(status);
  if (status.kind === "unsupported")
    return "Development build. Update checks run only in builds from the fork's release workflow.";
  if (newer) return `${newer.tag} is available.`;
  if (status.kind === "checking") return "Checking for a newer release…";
  if (status.kind === "failed") return "Could not reach GitHub to check for a newer release.";
  return "You have the latest release.";
}

export function ForkSettingsPanel() {
  const status = useForkReleaseStatus();
  const newer = newerForkRelease(status);

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
          description={describeStatus(status)}
          control={
            newer ? (
              <Button size="sm" onClick={() => void ensureLocalApi().shell.openExternal(newer.url)}>
                Download {newer.tag}
              </Button>
            ) : status.kind === "unsupported" ? null : (
              <Button
                size="sm"
                variant="outline"
                disabled={status.kind === "checking"}
                onClick={checkForkReleaseNow}
              >
                Check now
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
    </SettingsPageContainer>
  );
}
