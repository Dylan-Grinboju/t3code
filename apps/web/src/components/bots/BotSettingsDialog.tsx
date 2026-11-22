import { T, useGT } from "gt-react";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { useBotView } from "./botViewState";
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  isListedThreadLineage,
  AuthOrchestrationOperateScope,
  AuthSettingsWriteScope,
  DEFAULT_BOT_FRESH_AFTER_TURNS,
  type ScopedThreadRef,
  type ThreadBot,
} from "@t3tools/contracts";
import * as Equal from "effect/Equal";
import { useState } from "react";
import { usePanelTransitionDurationMs } from "../../panelAnimations";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { normalizeProjectPathForComparison, isHostPath } from "@t3tools/shared/path";
import { useQuietThreadShells, useQuietThreadShell } from "../../state/entities";
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
  const gt = useGT();
  const [open, setOpen] = useState(true);
  const transitionDurationMs = usePanelTransitionDurationMs();
  const [{ activity, history }, setView] = useBotView(threadRef);
  const shell = useQuietThreadShell(threadRef);
  const bot = shell?.bot;
  const threads = useQuietThreadShells();
  const [draftStatePath, setStatePath] = useState<string | null>(null);
  const statePath =
    draftStatePath ??
    bot?.statePath ??
    `~/.local/share/t3/bots/bot-${encodeURIComponent(threadRef.threadId)}/work.sqlite`;
  const sharedPath = threads.find(
    (thread) =>
      thread.environmentId === threadRef.environmentId &&
      thread.id !== threadRef.threadId &&
      thread.bot &&
      thread.deletedAt === null &&
      !thread.delegatedFrom &&
      isListedThreadLineage(thread.lineage) &&
      (isHostPath(statePath.trim()) ||
        (thread.projectId === shell?.projectId && thread.worktreePath === shell.worktreePath)) &&
      normalizeProjectPathForComparison(thread.bot.statePath) ===
        normalizeProjectPathForComparison(statePath.trim()),
  );
  const [draftGlyph, setGlyph] = useState<ThreadBot["glyph"] | null>(null);
  const glyph = draftGlyph === null ? bot?.glyph : draftGlyph;
  const [draftSkill, setSelectedSkill] = useState<string | null>(null);
  const selectedSkill = draftSkill ?? bot?.skillPath ?? "";
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
        return gt("Could not save bot settings. Reopen settings and try again.");
    }
    const command = draftSyncCommand?.trim();
    if (!value || command === undefined || command === syncCommand) return null;
    if (!supportsSync)
      return botChanged
        ? gt(
            "Bot settings saved. Reconnect to the bot’s environment and save the sync command again.",
          )
        : gt("Reconnect to the bot’s environment and save the sync command again.");
    if (!readEnvironmentScope(threadRef.environmentId, AuthSettingsWriteScope)) {
      return botChanged
        ? gt(
            "Bot settings saved. Use a connection with permission to edit environment settings to save the sync command.",
          )
        : gt(
            "Use a connection with permission to edit environment settings to save the sync command.",
          );
    }
    const result = await updateSettings({
      environmentId: threadRef.environmentId,
      input: { patch: { botSyncCommands: { [threadRef.threadId]: command || null } } },
    });
    return result._tag === "Failure"
      ? botChanged
        ? gt("Bot settings saved. Could not save the sync command. Click Save bot to retry.")
        : gt("Could not save the sync command. Click Save bot to retry.")
      : null;
  };
  const save = async (value: ThreadBot | null, reload = false) => {
    setSaving(true);
    setError(null);
    const message = await persistSettings(value).catch(() => gt("Reopen settings and try again."));
    setSaving(false);
    if (message) setError(message);
    else {
      if (reload) armFreshSession(scopedThreadKey(threadRef));
      setOpen(false);
    }
  };
  if (!shell) return null;
  return (
    <Dialog
      open={open}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClose();
      }}
      onOpenChange={(open) => {
        if (!open && !saving) {
          if (confirmingDisable) setConfirmingDisable(false);
          else setOpen(false);
        }
      }}
    >
      <DialogPopup
        transitionDurationMs={transitionDurationMs}
        role={confirmingDisable ? "alertdialog" : "dialog"}
      >
        <DialogHeader>
          <DialogTitle>
            {confirmingDisable
              ? gt("Disable bot?")
              : bot
                ? gt("Bot settings")
                : gt("Make this a bot")}
          </DialogTitle>
          <DialogDescription>
            {confirmingDisable
              ? gt(
                  "This removes the bot settings and returns this chat to the normal thread list. Conversation history and work files are kept. Existing automations continue until you disable them in Automations. A saved sync command becomes available again if you re-enable the bot.",
                )
              : gt("Keep a standing objective and work state across conversations.")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel hidden={confirmingDisable}>
          {bot && (
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b pb-4">
              <ToggleGroup
                aria-label={gt("Conversation detail")}
                value={[activity ? "activity" : "quiet"]}
                onValueChange={(value) => {
                  if (value.length) setView({ activity: value[0] === "activity", history });
                }}
              >
                <Toggle value="quiet">
                  <T>Quiet</T>
                </Toggle>
                <Toggle value="activity">
                  <T>Activity</T>
                </Toggle>
              </ToggleGroup>
              <ToggleGroup
                aria-label={gt("Conversation history")}
                disabled={activity}
                value={[history ? "history" : "recent"]}
                onValueChange={(value) => {
                  if (value.length) setView({ activity, history: value[0] === "history" });
                }}
              >
                <Toggle value="recent">
                  <T>Recent</T>
                </Toggle>
                <Toggle value="history">
                  <T>History</T>
                </Toggle>
              </ToggleGroup>
            </div>
          )}

          <form
            aria-label={gt("Bot settings")}
            aria-busy={saving}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save(
                {
                  objective: String(data.get("objective")).trim(),
                  skillPath: String(data.get("skillPath")).trim(),
                  statePath: String(data.get("statePath")).trim(),
                  freshAfterTurns: Number(data.get("freshAfterTurns")),
                  ...(glyph ? { glyph } : {}),
                  ...(iconColor ? { iconColor } : {}),
                },
                (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "reload",
              );
            }}
          >
            <fieldset disabled={saving || !canOperate} className="grid min-w-0 gap-4">
              <BotIconColorPicker
                glyph={glyph}
                onGlyphChange={setGlyph}
                color={iconColor}
                onChange={setIconColor}
              />
              <label className="grid gap-1.5 text-xs font-medium">
                <T>Standing objective</T>
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
                <BotSkillPicker
                  onChange={setSelectedSkill}
                  threadRef={threadRef}
                  defaultValue={bot?.skillPath ?? ""}
                />
                <label className="grid min-w-0 gap-1.5 text-xs font-medium">
                  <T>Durable work state path</T>
                  <Input
                    name="statePath"
                    required
                    maxLength={2048}
                    value={statePath}
                    onChange={(event) => setStatePath(event.target.value)}
                  />
                  {sharedPath && (
                    <span className="text-xs text-muted-foreground">
                      {gt("Also used by {title}. Save to share this work state.", {
                        title: sharedPath.title,
                      })}
                    </span>
                  )}
                </label>
              </div>
              {supportsSync && (
                <div className="grid gap-1.5">
                  <label htmlFor="bot-sync-command" className="text-xs font-medium">
                    <T>Background sync command</T>
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
                    placeholder={gt("Enter a shell command")}
                  />
                  <p id="bot-sync-command-hint" className="text-xs text-muted-foreground">
                    {canEditSync
                      ? gt(
                          "Sync now runs this command in the bot’s project. Clear it to remove the link.",
                        )
                      : gt(
                          "Editing this command requires permission to change environment settings.",
                        )}
                  </p>
                </div>
              )}
              <label className="grid max-w-64 gap-1.5 text-xs font-medium">
                <T>Start fresh after completed turns</T>
                <Input
                  name="freshAfterTurns"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={bot?.freshAfterTurns ?? DEFAULT_BOT_FRESH_AFTER_TURNS}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                <T>
                  Set the turn limit to 0 to disable automatic restarts after completed turns. Fresh
                  sessions reload the skill and work state. After editing the skill, Reload skill
                  starts one with your next message. History stays searchable. Use this thread’s
                  Automations to schedule checks in fresh sessions; bot settings do not start a
                  schedule.
                </T>
              </p>
              {error && (
                <p role="alert" className="text-xs text-destructive-foreground">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button type="submit" disabled={saving}>
                  {saving ? gt("Saving…") : gt("Save bot")}
                </Button>
                {bot &&
                  freshSessions &&
                  shell.latestRun != null &&
                  selectedSkill.trim() !== bot.skillPath && (
                    <Button type="submit" value="reload" disabled={saving}>
                      <T>Save and reload on next message</T>
                    </Button>
                  )}
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  <T>Cancel</T>
                </Button>
                {bot &&
                  freshSessions &&
                  shell.latestRun != null &&
                  selectedSkill.trim() === bot.skillPath && (
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        armFreshSession(scopedThreadKey(threadRef));
                        setOpen(false);
                      }}
                    >
                      <T>Reload skill</T>
                    </Button>
                  )}
                {bot && (
                  <Button
                    variant="destructive-outline"
                    disabled={saving}
                    onClick={() => setConfirmingDisable(true)}
                  >
                    <T>Disable bot</T>
                  </Button>
                )}
              </div>
            </fieldset>
          </form>
        </DialogPanel>
        {confirmingDisable && (
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setConfirmingDisable(false)}>
              <T>Cancel</T>
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !canOperate}
              onClick={() => {
                setConfirmingDisable(false);
                void save(null);
              }}
            >
              <T>Disable bot</T>
            </Button>
          </DialogFooter>
        )}
      </DialogPopup>
    </Dialog>
  );
}
