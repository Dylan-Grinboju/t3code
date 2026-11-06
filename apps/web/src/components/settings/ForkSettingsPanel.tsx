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
      <SettingsSection id="fork-sidebar" title="Sidebar">
        <SidebarDisplaySettings />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
