import type { ScopedThreadRef, ThreadBot } from "@t3tools/contracts";
import { useId, useState } from "react";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ActivityIcon, BotIcon, ChevronDownIcon, ListTodoIcon, Settings2Icon } from "lucide-react";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { BotAvatar, BotStatus } from "../bots/BotIdentity";
import { cn } from "../../lib/utils";
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
  const settingsId = useId();
  const workId = useId();
  const viewHintId = useId();
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
    <div
      className={cn(
        "max-h-[60%] shrink-0 overflow-y-auto overscroll-contain border-b px-4 py-2 text-sm sm:px-6",
        bot && "bg-gradient-to-r from-primary/5 via-transparent to-transparent",
      )}
    >
      {bot && (
        <div className="flex items-start gap-3 pb-3 pt-2">
          <BotAvatar needsYou={status?.needsYou ?? false} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-words font-semibold tracking-tight">
                {shell?.title ?? "Bot"}
              </span>
              <BotStatus status={status} />
            </div>
            <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
              {bot.objective}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant={editing && !workOpen ? "secondary" : "ghost-muted"}
          size="sm"
          disabled={!canOperate || saving}
          aria-expanded={editing && !workOpen}
          aria-controls={editing ? settingsId : undefined}
          onClick={() => {
            setEditing(workOpen || !editing);
            setWorkOpen(false);
          }}
        >
          {bot ? <Settings2Icon aria-hidden /> : <BotIcon aria-hidden />}
          {bot ? "Bot settings" : "Make this a bot"}
        </Button>
        {bot && (
          <>
            <Button
              variant={workOpen ? "secondary" : "ghost"}
              size="sm"
              aria-expanded={workOpen}
              aria-controls={workOpen ? workId : undefined}
              onClick={() => {
                setWorkOpen(!workOpen);
              }}
            >
              <ListTodoIcon aria-hidden />
              Work
              <ChevronDownIcon
                aria-hidden
                className={cn("size-3 motion-safe:transition-transform", workOpen && "rotate-180")}
              />
            </Button>
            <ToggleGroup
              aria-label="Conversation detail"
              aria-describedby={viewHintId}
              value={[activity ? "activity" : "quiet"]}
              onValueChange={(value) => {
                if (value.length > 0 && (value[0] === "activity") !== activity) onActivity();
              }}
            >
              <Toggle value="quiet">Quiet</Toggle>
              <Toggle value="activity">
                <ActivityIcon aria-hidden />
                Activity
              </Toggle>
            </ToggleGroup>
            <ToggleGroup
              aria-label="Conversation history"
              disabled={activity}
              aria-describedby={viewHintId}
              value={[history ? "history" : "recent"]}
              onValueChange={(value) => {
                if (value.length > 0 && (value[0] === "history") !== history) onHistory();
              }}
            >
              <Toggle value="recent">Recent</Toggle>
              <Toggle value="history">History</Toggle>
            </ToggleGroup>
          </>
        )}
      </div>
      {bot && (
        <p id={viewHintId} className="pb-1 pt-2 text-xs text-muted-foreground">
          {activity
            ? "All loaded replies and tool activity"
            : `Replies and requests that need you · ${history ? "Loaded history" : "Recent replies"}`}
        </p>
      )}
      {bot && workOpen && (
        <div id={workId}>
          <BotWorkPanel threadRef={threadRef} />
        </div>
      )}
      {editing && (
        <form
          id={settingsId}
          aria-label="Bot settings"
          hidden={workOpen}
          aria-busy={saving}
          className="mt-3 rounded-xl border bg-background p-4"
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
          <fieldset disabled={saving || !canOperate} className="grid min-w-0 gap-4">
            <div>
              <h3 className="font-medium">
                {bot ? "Give your bot direction" : "A home for ongoing work"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep a standing objective and work state across conversations.
              </p>
            </div>
            <label className="grid gap-1.5 text-xs font-medium">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5 text-xs font-medium">
                Skill path on the environment's machine
                <Input
                  name="skillPath"
                  required
                  maxLength={2048}
                  defaultValue={bot?.skillPath ?? "~/.claude/skills/chief-of-staff/SKILL.md"}
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-xs font-medium">
                Durable work state path
                <Input
                  name="statePath"
                  required
                  maxLength={2048}
                  defaultValue={bot?.statePath ?? "~/.local/share/chief-of-staff/work.sqlite"}
                />
              </label>
            </div>
            <label className="grid max-w-64 gap-1.5 text-xs font-medium">
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
            {error && (
              <p role="alert" className="text-xs text-destructive-foreground">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save bot"}
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
          </fieldset>
        </form>
      )}
    </div>
  );
}
