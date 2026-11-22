import { T, useGT } from "gt-react";
import { useState } from "react";
import * as Option from "effect/Option";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { useProject, useThreadVisibleTurnItems } from "../../state/entities";
import { useEnvironmentThread } from "../../state/threads";
import ChatMarkdown from "../ChatMarkdown";
import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { Button } from "../ui/button";
import type { ReferencePeekTarget } from "./referencePeek";

export default function ReferencePeekContent({ target }: { target: ReferencePeekTarget }) {
  return target.kind === "file" ? <FilePeek target={target} /> : <ThreadPeek target={target} />;
}

function FilePeek({ target }: { target: Extract<ReferencePeekTarget, { kind: "file" }> }) {
  const gt = useGT();
  const file = useProjectFileQuery(target.threadRef.environmentId, target.cwd, target.path);
  if (file.error)
    return (
      <div className="p-6 text-sm">
        <p role="alert">{file.error}</p>
        <Button size="sm" variant="ghost" onClick={file.refresh}>
          <T>Retry</T>
        </Button>
      </div>
    );
  if (!file.data)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        <T>Loading file…</T>
      </p>
    );
  const lines = file.data.contents.split("\n");
  const start = target.line ? Math.max(0, Math.min(lines.length - 1, target.line - 11)) : 0;
  const visible = lines
    .slice(start, start + 160)
    .map((text, index) => ({ text, number: start + index + 1 }));
  return (
    <div className="min-h-0 overflow-auto pb-4">
      {start > 0 || lines.length > start + visible.length || file.data.truncated ? (
        <p className="px-6 pb-3 text-xs text-muted-foreground">
          {gt("Showing lines {first}–{last}. Open in panel for the full file.", {
            first: start + 1,
            last: start + visible.length,
          })}
        </p>
      ) : null}
      <pre className="text-xs leading-6">
        {visible.map((line) => (
          <div key={line.number} className={line.number === target.line ? "bg-accent" : undefined}>
            <span
              aria-hidden
              className="inline-block w-14 select-none pr-4 text-right text-muted-foreground"
            >
              {line.number}
            </span>
            <code>{line.text || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

function ThreadPeek({ target }: { target: Extract<ReferencePeekTarget, { kind: "thread" }> }) {
  const gt = useGT();
  const state = useEnvironmentThread(target.threadRef.environmentId, target.threadRef.threadId);
  const thread = Option.getOrNull(state.data);
  const project = useProject(
    thread ? scopeProjectRef(target.threadRef.environmentId, thread.thread.projectId) : null,
  );
  const items = useThreadVisibleTurnItems(target.threadRef);
  const [count, setCount] = useState(8);
  const messages = items.flatMap(({ item }) =>
    item.type === "user_message" || item.type === "assistant_message" ? [item] : [],
  );
  if (state.status === "deleted" || Option.isSome(state.error))
    return (
      <p role="alert" className="p-6 text-sm">
        {Option.getOrNull(state.error) ?? gt("This thread is no longer available.")}
      </p>
    );
  if (!thread)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        <T>Loading thread…</T>
      </p>
    );
  return (
    <div className="min-h-0 overflow-auto px-6 pb-6">
      {messages.length > count ? (
        <div className="mb-4">
          <Button size="xs" variant="ghost" onClick={() => setCount(count + 8)}>
            <T>Show earlier messages</T>
          </Button>
        </div>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
        <T>Recent messages</T>
      </p>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <T>No messages yet.</T>
        </p>
      ) : null}
      {messages.slice(-count).map((message) => (
        <article key={message.messageId} className="mb-5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {message.type === "user_message"
              ? message.senderThreadId
                ? gt("Agent message")
                : gt("You")
              : gt("Assistant")}
          </p>
          <ChatMarkdown
            text={message.text}
            cwd={thread.thread.worktreePath ?? project?.workspaceRoot}
            threadRef={target.threadRef}
            environmentId={target.threadRef.environmentId}
          />
        </article>
      ))}
    </div>
  );
}
