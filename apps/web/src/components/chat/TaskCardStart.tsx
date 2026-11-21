import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef, TurnItemId } from "@t3tools/contracts";
import type { TaskCard } from "@t3tools/shared/taskCard";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, CheckIcon, PlayIcon } from "lucide-react";
import "./taskCardStart.css";
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
  const [justStarted, setJustStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (!source || !permitted || starting) return;
    const input = taskCardLaunchInput(targetId, card, source);
    if (!input) return;
    setStarting(true);
    setError(null);
    try {
      const result = await launch({ environmentId, input });
      if (result._tag === "Success") {
        setJustStarted(true);
        lookup.refresh();
      } else if (!isAtomCommandInterrupted(result)) {
        const cause = squashAtomCommandFailure(result);
        setError(cause instanceof Error ? cause.message : "Could not start the task.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the task.");
    }
    setStarting(false);
  };
  if (justStarted || target || lookup.data?.[targetId]) {
    return (
      <Button
        className="w-24"
        size="micro"
        variant="outline"
        render={<Link to="/$environmentId/$threadId" params={targetRef} />}
      >
        <span aria-hidden className="inline-grid" data-task-launched={justStarted || undefined}>
          {justStarted && (
            <CheckIcon data-launch-check="" className="col-start-1 row-start-1 opacity-0" />
          )}
          <ArrowUpRightIcon data-launch-arrow="" className="col-start-1 row-start-1" />
        </span>
        View thread
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        className="w-24"
        variant="outline"
        size="micro"
        disabled={!source || !permitted || starting}
        onClick={() => void start()}
      >
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
