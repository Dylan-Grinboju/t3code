import type { ScopedThreadRef, ThreadBot } from "@t3tools/contracts";
import { useState } from "react";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { BotIcon } from "lucide-react";
import { useQuietThreadShell } from "../../state/entities";
import { BotWorkPanel } from "../bots/BotWorkPanel";
import { botStatus } from "../bots/botPresentation";

export function BotControls({
  threadRef,
  bot,
  canOperate,
  activity,
  history,
  onActivity,
  onHistory,
}: {
  threadRef: ScopedThreadRef;
  bot: ThreadBot | null | undefined;
  canOperate: boolean;
  activity: boolean;
  history: boolean;
  onActivity: () => void;
  onHistory: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const shell = useQuietThreadShell(bot ? threadRef : null);
  const status = shell ? botStatus(shell) : null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useOrchestrationCommand(threadEnvironment.updateMetadata);
  const save = async (value: ThreadBot | null) => {
    setSaving(true);
    setError(null);
    try {
      const result = await update({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId, bot: value },
      });
      if (result._tag === "Failure")
        setError("Could not save bot settings. Your previous settings are unchanged.");
      else setEditing(false);
    } catch {
      setError("Could not confirm bot settings. Reopen settings before retrying.");
    }
    setSaving(false);
  };
  return (
    <div className="shrink-0 border-b px-4 py-2 text-sm">
      {bot && (
        <div className="flex items-start gap-3 py-2">
          <BotIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{shell?.title ?? "Bot"}</span>
              <span className={`text-xs ${status?.colorClass ?? "text-muted-foreground"}`}>
                {status?.needsYou ? "Needs you · " : ""}
                {status?.label ?? "Loading"}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{bot.objective}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost-muted"
          size="sm"
          disabled={!canOperate}
          onClick={() => setEditing(!editing)}
        >
          {bot ? "Bot settings" : "Make this a bot"}
        </Button>
        {bot && (
          <>
            <Button
              variant={workOpen ? "secondary" : "ghost"}
              size="sm"
              aria-expanded={workOpen}
              onClick={() => setWorkOpen(!workOpen)}
            >
              Work
            </Button>
            <Button variant="ghost" size="sm" onClick={onActivity}>
              {activity ? "Quiet view" : "Activity"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onHistory}>
              {history ? "Recent" : "History"}
            </Button>
          </>
        )}
      </div>
      {bot && workOpen && <BotWorkPanel threadRef={threadRef} />}
      {editing && (
        <form
          className="grid gap-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void save({
              objective: String(data.get("objective")).trim(),
              skillPath: String(data.get("skillPath")).trim(),
              statePath: String(data.get("statePath")).trim(),
              freshAfterTurns: Number(data.get("freshAfterTurns")),
            });
          }}
        >
          <label className="grid gap-1">
            Standing objective
            <Textarea
              name="objective"
              required
              maxLength={8000}
              defaultValue={
                bot?.objective ??
                "Organize my engineering work, reconcile changes, and recommend the next action."
              }
            />
          </label>
          <label className="grid gap-1">
            Skill path on the environment's machine
            <Input
              name="skillPath"
              required
              maxLength={2048}
              defaultValue={bot?.skillPath ?? "~/.claude/skills/chief-of-staff/SKILL.md"}
            />
          </label>
          <label className="grid gap-1">
            Durable work state path
            <Input
              name="statePath"
              required
              maxLength={2048}
              defaultValue={bot?.statePath ?? "~/.local/share/chief-of-staff/work.sqlite"}
            />
          </label>
          <label className="grid gap-1">
            Start fresh after completed turns
            <Input
              name="freshAfterTurns"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={bot?.freshAfterTurns ?? 12}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Fresh sessions reload the skill and work state. History stays searchable. Use this
            thread’s Automations to schedule checks in fresh sessions; bot settings do not start a
            schedule.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              Save bot
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {bot && (
              <Button variant="ghost" disabled={saving} onClick={() => void save(null)}>
                Use normal thread
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
