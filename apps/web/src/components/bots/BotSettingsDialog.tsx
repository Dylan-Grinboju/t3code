import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { useBotView } from "./botViewState";
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  AuthOrchestrationOperateScope,
  AuthSettingsWriteScope,
  DEFAULT_BOT_FRESH_AFTER_TURNS,
  type ScopedThreadRef,
  type ThreadBot,
} from "@t3tools/contracts";
import * as Equal from "effect/Equal";
import { useState } from "react";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { useQuietThreadShell } from "../../state/entities";
import { serverEnvironment } from "../../state/server";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { armFreshSession } from "../chat/freshSessionArms";
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
  const canEditSync = useEnvironmentScope(threadRef.environmentId, AuthSettingsWriteScope);
  const config = useAtomValue(serverEnvironment.configValueAtom(threadRef.environmentId));
  const freshSessions = config?.environment.capabilities.freshContext === true;
  const supportsSync = config?.environment.capabilities.botSync === true;
  const configuredCommand = config?.settings.botSyncCommands[threadRef.threadId];
  const syncCommand = typeof configuredCommand === "string" ? configuredCommand : "";
  const [draftSyncCommand, setSyncCommand] = useState<string | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useOrchestrationCommand(threadEnvironment.updateMetadata);
  const updateSettings = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const persistSettings = async (value: ThreadBot | null) => {
    const botChanged = !Equal.equals(bot, value);
    if (botChanged) {
      const result = await update({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId, bot: value },
      });
      if (result._tag === "Failure")
        return "Could not save bot settings. Reopen settings and try again.";
    }
    const command = draftSyncCommand?.trim();
    if (!value || command === undefined || command === syncCommand) return null;
    const prefix = botChanged ? "Bot settings saved. " : "";
    if (!supportsSync)
      return `${prefix}Reconnect to the bot’s environment and save the sync command again.`;
    if (!readEnvironmentScope(threadRef.environmentId, AuthSettingsWriteScope)) {
      return `${prefix}Use a connection with permission to edit environment settings to save the sync command.`;
    }
    const result = await updateSettings({
      environmentId: threadRef.environmentId,
      input: { patch: { botSyncCommands: { [threadRef.threadId]: command || null } } },
    });
    return result._tag === "Failure"
      ? `${prefix}Could not save the sync command. Click Save bot to retry.`
      : null;
  };
  const save = async (value: ThreadBot | null) => {
    setSaving(true);
    setError(null);
    const message = await persistSettings(value).catch(() => "Reopen settings and try again.");
    setSaving(false);
    if (message) setError(message);
    else onClose();
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
              ? "This removes the bot settings and returns this chat to the normal thread list. Conversation history and work files are kept. Existing automations continue until you disable them in Automations. A saved sync command becomes available again if you re-enable the bot."
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
              {supportsSync && (
                <div className="grid gap-1.5">
                  <label htmlFor="bot-sync-command" className="text-xs font-medium">
                    Background sync command
                  </label>
                  <Textarea
                    id="bot-sync-command"
                    aria-describedby="bot-sync-command-hint"
                    name="syncCommand"
                    rows={2}
                    disabled={!canEditSync}
                    value={draftSyncCommand ?? syncCommand}
                    onChange={(event) => setSyncCommand(event.target.value)}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    placeholder="Enter a shell command"
                  />
                  <p id="bot-sync-command-hint" className="text-xs text-muted-foreground">
                    {canEditSync
                      ? "Sync now runs this command in the bot’s project. Clear it to remove the link."
                      : "Editing this command requires permission to change environment settings."}
                  </p>
                </div>
              )}
              <label className="grid max-w-64 gap-1.5 text-xs font-medium">
                Start fresh after completed turns
                <Input
                  name="freshAfterTurns"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={bot?.freshAfterTurns ?? DEFAULT_BOT_FRESH_AFTER_TURNS}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Fresh sessions reload the skill and work state. After editing the skill, Reload
                skill starts one with your next message. History stays searchable. Use this thread’s
                Automations to schedule checks in fresh sessions; bot settings do not start a
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
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                {bot && freshSessions && shell.latestRun != null && (
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      armFreshSession(scopedThreadKey(threadRef));
                      onClose();
                    }}
                  >
                    Reload skill
                  </Button>
                )}
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
