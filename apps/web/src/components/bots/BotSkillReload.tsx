import { T, useGT } from "gt-react";
import { useEffect } from "react";
import { scopedThreadKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  AuthFilesystemReadScope,
  AuthOrchestrationOperateScope,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { isHostPath, resolveWorkspaceFilePath } from "@t3tools/shared/path";
import { useAtomValue } from "@effect/atom-react";
import { useProject } from "../../state/entities";
import { useEnvironmentScope } from "../../state/session";
import { filesystemEnvironment } from "../../state/filesystem";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { armFreshSession, useFreshSessionArmed } from "../chat/freshSessionArms";
import { Button } from "../ui/button";

export function BotSkillReload({
  threadRef,
  shell,
}: {
  threadRef: ScopedThreadRef;
  shell: EnvironmentThreadShell;
}) {
  const gt = useGT();
  const { environmentId } = threadRef;
  const key = scopedThreadKey(threadRef);
  const armed = useFreshSessionArmed(key);
  const canRead = useEnvironmentScope(environmentId, AuthFilesystemReadScope);
  const canOperate = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const supported = useAtomValue(
    serverEnvironment.configValueAtom(environmentId),
    (config) => config?.environment.capabilities.freshContext === true,
  );
  const project = useProject(scopeProjectRef(environmentId, shell.projectId));
  const cwd = shell.worktreePath ?? project?.workspaceRoot;
  const configured = shell.bot?.skillPath ?? "";
  const path = isHostPath(configured)
    ? configured
    : cwd
      ? resolveWorkspaceFilePath(configured, cwd)
      : null;
  const lastMessage =
    shell.latestUserAuthoredMessageAt === undefined
      ? shell.latestUserMessageAt
      : shell.latestUserAuthoredMessageAt;
  const enabled = supported && canRead && canOperate && !armed && !!lastMessage && !!path;
  const query = enabled
    ? filesystemEnvironment.getMetadata({
        environmentId,
        input: { paths: [path], includeModifiedAt: true },
      })
    : null;
  const { data, refresh } = useEnvironmentQuery(query);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a skill can be edited in another program while this chat is open.
  useEffect(() => {
    if (!query) return;
    const check = () => {
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(check, 15000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [query, refresh]);
  const modified = data?.entries[0]?.modifiedAtMs;
  if (!enabled || modified === undefined || modified <= Date.parse(lastMessage)) return null;
  return (
    <Button
      variant="outline"
      size="micro"
      title={gt(
        "Skill changed since your last message. Start a fresh session with your next message.",
      )}
      onClick={() => armFreshSession(key)}
    >
      <T>Skill changed · Reload</T>
    </Button>
  );
}
