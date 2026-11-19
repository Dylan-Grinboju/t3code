import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef, TurnItemId } from "@t3tools/contracts";
import type { TaskCard } from "@t3tools/shared/taskCard";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, PlayIcon } from "lucide-react";
import { useState } from "react";

import { useQuietThreadShell } from "../../state/entities";
import { launchThread, orchestrationEnvironment } from "../../state/orchestration";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { taskCardLaunchInput, taskCardThreadId } from "./taskCardLaunch.logic";

export function TaskCardStart({
  card,
  threadRef,
  itemId,
}: {
  card: TaskCard;
  threadRef: ScopedThreadRef;
  itemId: TurnItemId;
}) {
  const { environmentId } = threadRef;
  const targetId = taskCardThreadId(threadRef.threadId, itemId);
  const targetRef = scopeThreadRef(environmentId, targetId);
  const source = useQuietThreadShell(threadRef);
  const target = useQuietThreadShell(targetRef);
  const lookup = useEnvironmentQuery(
    target === null
      ? orchestrationEnvironment.threadTitles({ environmentId, input: { threadIds: [targetId] } })
      : null,
  );
  const permitted = useAtomValue(launchThread.permissionAtom(environmentId));
  const launch = useAtomCommand(launchThread, { reportFailure: false });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (!source || !permitted || starting) return;
    const input = taskCardLaunchInput(targetId, card, source);
    if (!input) return;
    setStarting(true);
    setError(null);
    try {
      const result = await launch({ environmentId, input });
      if (result._tag === "Success") lookup.refresh();
      else if (!isAtomCommandInterrupted(result)) {
        const cause = squashAtomCommandFailure(result);
        setError(cause instanceof Error ? cause.message : "Could not start the task.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the task.");
    }
    setStarting(false);
  };
  if (target || lookup.data?.[targetId]) {
    return (
      <Button
        size="xs"
        variant="outline"
        render={<Link to="/$environmentId/$threadId" params={targetRef} />}
      >
        View thread <ArrowUpRightIcon aria-hidden />
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="xs" disabled={!source || !permitted || starting} onClick={() => void start()}>
        <PlayIcon aria-hidden />
        {starting ? "Starting…" : "Start"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive-foreground">
          {error}
        </span>
      )}
    </div>
  );
}
