import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { useBotView } from "./botViewState";
import { useAtomValue } from "@effect/atom-react";
import {
  AuthOrchestrationOperateScope,
  type ScopedThreadRef,
  type ThreadBot,
} from "@t3tools/contracts";
import { useState } from "react";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { useQuietThreadShell } from "../../state/entities";
import { useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogPopup,
} from "../ui/dialog";
import { botSettingsThreadAtom } from "./botSettingsState";
import { BotSkillPicker } from "./BotSkillPicker";
import { BotIconColorPicker } from "./BotIconColorPicker";

export function BotSettingsDialogHost() {
  const threadRef = useAtomValue(botSettingsThreadAtom);
  return threadRef ? (
    <BotSettingsDialog
      key={`${threadRef.environmentId}:${threadRef.threadId}`}
      threadRef={threadRef}
      onClose={() => appAtomRegistry.set(botSettingsThreadAtom, null)}
    />
  ) : null;
}

export function BotSettingsDialog({
  threadRef,
  onClose,
}: {
  threadRef: ScopedThreadRef;
  onClose: () => void;
}) {
  const [{ activity, history }, setView] = useBotView(threadRef);
  const shell = useQuietThreadShell(threadRef);
  const bot = shell?.bot;
  const [draftIconColor, setIconColor] = useState<ThreadBot["iconColor"] | null>(null);
  const iconColor = draftIconColor === null ? bot?.iconColor : draftIconColor;
  const canOperate = useEnvironmentScope(threadRef.environmentId, AuthOrchestrationOperateScope);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
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
      else onClose();
    } catch {
      setError("Could not confirm bot settings. Reopen settings before retrying.");
    }
    setSaving(false);
  };
  if (!shell) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) {
          if (confirmingDisable) setConfirmingDisable(false);
          else onClose();
        }
      }}
    >
      <DialogPopup role={confirmingDisable ? "alertdialog" : "dialog"}>
        <DialogHeader>
          <DialogTitle>
            {confirmingDisable ? "Disable bot?" : bot ? "Bot settings" : "Make this a bot"}
          </DialogTitle>
          <DialogDescription>
            {confirmingDisable
              ? "This removes the bot settings and returns this chat to the normal thread list. Conversation history and work files are kept. Existing automations continue until you disable them in Automations."
              : "Keep a standing objective and work state across conversations."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel hidden={confirmingDisable}>
          {bot && (
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b pb-4">
              <ToggleGroup
                aria-label="Conversation detail"
                value={[activity ? "activity" : "quiet"]}
                onValueChange={(value) => {
                  if (value.length) setView({ activity: value[0] === "activity", history });
                }}
              >
                <Toggle value="quiet">Quiet</Toggle>
                <Toggle value="activity">Activity</Toggle>
              </ToggleGroup>
              <ToggleGroup
                aria-label="Conversation history"
                disabled={activity}
                value={[history ? "history" : "recent"]}
                onValueChange={(value) => {
                  if (value.length) setView({ activity, history: value[0] === "history" });
                }}
              >
                <Toggle value="recent">Recent</Toggle>
                <Toggle value="history">History</Toggle>
              </ToggleGroup>
            </div>
          )}

          <form
            aria-label="Bot settings"
            aria-busy={saving}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save({
                objective: String(data.get("objective")).trim(),
                skillPath: String(data.get("skillPath")).trim(),
                statePath: String(data.get("statePath")).trim(),
                freshAfterTurns: Number(data.get("freshAfterTurns")),
                ...(iconColor ? { iconColor } : {}),
              });
            }}
          >
            <fieldset disabled={saving || !canOperate} className="grid min-w-0 gap-4">
              <BotIconColorPicker color={iconColor} onChange={setIconColor} />
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
                <BotSkillPicker threadRef={threadRef} defaultValue={bot?.skillPath ?? ""} />
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
                thread’s Automations to schedule checks in fresh sessions; bot settings do not start
                a schedule.
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
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                {bot && (
                  <Button
                    variant="destructive-outline"
                    disabled={saving}
                    onClick={() => setConfirmingDisable(true)}
                  >
                    Disable bot
                  </Button>
                )}
              </div>
            </fieldset>
          </form>
        </DialogPanel>
        {confirmingDisable && (
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setConfirmingDisable(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !canOperate}
              onClick={() => {
                setConfirmingDisable(false);
                void save(null);
              }}
            >
              Disable bot
            </Button>
          </DialogFooter>
        )}
      </DialogPopup>
    </Dialog>
  );
}
