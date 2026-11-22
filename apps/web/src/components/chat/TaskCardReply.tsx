import { T, useGT } from "gt-react";
import { useState } from "react";
import type { ResponseContextRecord, ScopedThreadRef } from "@t3tools/contracts";
import { MessageId } from "@t3tools/contracts";
import { responseContextRecord, responseContextReference } from "../../lib/composerContextRecords";
import { formatInlineContextReference } from "../../lib/composerContextReferences";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { TimelineRow } from "./timelineRowContext";

export function TaskCardReply({
  row,
  threadRef,
  send,
}: {
  row: Extract<TimelineRow, { kind: "task-card" }>;
  threadRef: ScopedThreadRef;
  send: (text: string, reply: ResponseContextRecord) => Promise<void>;
}) {
  const gt = useGT();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const question = row.card.question;
  if (!question) return null;
  const submit = async (answer: string) => {
    const text = answer.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const record = responseContextRecord({
      citation: {
        version: 1,
        ...threadRef,
        messageId: MessageId.make(row.id),
        text: question,
        start: 0,
        end: question.length,
        prefix: "",
        suffix: "",
      },
      itemId: row.itemId,
      subagents: [],
    });
    const sendAnswer = async () => {
      await send(
        formatInlineContextReference(responseContextReference(record)) + " " + text,
        record,
      );
      setSent(text);
    };
    await sendAnswer()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : gt("Could not send the answer."));
      })
      .finally(() => setPending(false));
  };
  if (sent)
    return (
      <p role="status" className="text-xs">
        {gt("You answered · {answer}", { answer: sent })}
      </p>
    );
  return (
    <form
      className="pointer-events-auto relative grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(draft);
      }}
    >
      <fieldset disabled={pending} className="grid gap-2">
        {row.card.suggestedAnswers && (
          <div className="flex flex-wrap gap-1">
            {row.card.suggestedAnswers.map((answer) => (
              <Button
                type="button"
                key={answer}
                size="xs"
                variant="outline"
                onClick={() => void submit(answer)}
              >
                {answer}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            aria-label={gt("Answer to {question}", { question })}
            value={draft}
            placeholder={gt("Your answer…")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={!draft.trim()}>
            <T>Send</T>
          </Button>
        </div>
      </fieldset>
      {error && (
        <span role="alert" className="text-xs text-destructive-foreground">
          {error}
        </span>
      )}
    </form>
  );
}
