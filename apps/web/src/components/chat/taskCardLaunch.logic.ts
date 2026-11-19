import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  CommandId,
  MessageId,
  ThreadId,
  type OrchestrationV2ThreadLaunchInput,
  type TurnItemId,
} from "@t3tools/contracts";
import type { TaskCard } from "@t3tools/shared/taskCard";

export function taskCardThreadId(sourceThreadId: ThreadId, itemId: TurnItemId) {
  const identity = JSON.stringify([sourceThreadId, itemId]);
  return ThreadId.make(`task-card-${bytesToHex(sha256(new TextEncoder().encode(identity)))}`);
}

export function taskCardLaunchInput(
  threadId: ThreadId,
  card: TaskCard,
  source: Pick<
    OrchestrationV2ThreadLaunchInput,
    "modelSelection" | "runtimeMode" | "interactionMode"
  >,
): OrchestrationV2ThreadLaunchInput | null {
  const { action } = card;
  if (action === undefined) return null;
  return {
    threadId,
    commandId: CommandId.make(threadId),
    projectId: action.projectId,
    title: card.title,
    modelSelection: action.modelSelection ?? source.modelSelection,
    runtimeMode: source.runtimeMode,
    interactionMode: source.interactionMode,
    workspaceStrategy: action.baseRef
      ? { type: "worktree", baseRef: action.baseRef, startFromOrigin: true }
      : { type: "root" },
    initialMessage: {
      messageId: MessageId.make(threadId),
      text: [card.title, card.sourceUrl, card.summary, action.instruction]
        .filter(Boolean)
        .join("\n\n"),
      attachments: [],
    },
  };
}
