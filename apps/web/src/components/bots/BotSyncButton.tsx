import { useGT } from "gt-react";
import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { useEnvironmentQuery } from "../../state/query";
import { botSyncStatus, runBotSync } from "../../state/orchestration";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";

export function BotSyncButton({
  threadRef: { environmentId, threadId },
}: {
  threadRef: ScopedThreadRef;
}) {
  const gt = useGT();
  const configured = useAtomValue(
    serverEnvironment.configValueAtom(environmentId),
    (config) =>
      config?.environment.capabilities.botSync === true &&
      typeof config.settings.botSyncCommands[threadId] === "string",
  );
  const canRun = useAtomValue(runBotSync.permissionAtom(environmentId));
  const supportsStatus = useAtomValue(
    serverEnvironment.configValueAtom(environmentId),
    (config) => config?.environment.capabilities.botSyncStatus === true,
  );
  const { data: state } = useEnvironmentQuery(
    configured && canRun && supportsStatus
      ? botSyncStatus({ environmentId, input: { threadId } })
      : null,
  );
  const run = useAtomCommand(runBotSync, { reportFailure: false });
  const [starting, setStarting] = useState(false);
  if (!configured || !canRun) return null;

  const sync = async () => {
    setStarting(true);
    const result = await run({ environmentId, input: { threadId } });
    setStarting(false);
    if (result._tag === "Success") {
      const started = result.value.status === "started";
      if (!supportsStatus)
        toastManager.add(
          stackedThreadToast({
            type: started ? "success" : "info",
            title: started
              ? gt("Background sync started")
              : gt("Background sync is already running"),
          }),
        );
    } else if (!isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: gt("Could not start background sync"),
          description: error instanceof Error ? error.message : undefined,
        }),
      );
    }
  };

  const running = state?.status === "running";
  const label = starting
    ? "Starting…"
    : running
      ? "Syncing…"
      : state?.status === "failed"
        ? "Sync failed · Retry"
        : state?.status === "succeeded"
          ? "Synced · Sync again"
          : "Sync now";
  return (
    <Button
      title={
        state?.status === "succeeded"
          ? "Last synced " + new Date(state.changedAt).toLocaleString()
          : undefined
      }
      variant="ghost-muted"
      size="micro"
      disabled={starting || running}
      onClick={() => void sync()}
    >
      <RefreshCwIcon aria-hidden />
      {label}
    </Button>
  );
}
