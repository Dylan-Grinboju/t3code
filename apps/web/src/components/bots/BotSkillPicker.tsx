import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { resolveProviderSkillsForCwd } from "@t3tools/client-runtime/providerSkills";
import type { ScopedThreadRef, ServerProviderSkill } from "@t3tools/contracts";
import { formatProviderSkillDisplayName } from "@t3tools/shared/inlineSkills";
import { useId, useState } from "react";
import { searchProviderSkills } from "../../providerSkillSearch";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { serverEnvironment } from "../../state/server";
import { useProviderWorkspaceSnapshotRefresh } from "../chat/useProviderWorkspaceSnapshotRefresh";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "../ui/combobox";

export function BotSkillPicker({
  threadRef,
  defaultValue,
  onChange,
}: {
  threadRef: ScopedThreadRef;
  defaultValue: string;
  onChange?: ((path: string) => void) | undefined;
}) {
  const shell = useQuietThreadShell(threadRef);
  const project = useProject(
    shell ? scopeProjectRef(threadRef.environmentId, shell.projectId) : null,
  );
  const providers = useAtomValue(serverEnvironment.providersValueAtom(threadRef.environmentId));
  const provider = providers?.find(
    (candidate) => candidate.instanceId === shell?.providerInstanceId,
  );
  const gitCwd = shell?.worktreePath ?? project?.workspaceRoot ?? null;
  const { refresh, scanning } = useProviderWorkspaceSnapshotRefresh({
    environmentId: threadRef.environmentId,
    gitCwd,
    instanceId: provider?.instanceId,
  });
  return (
    <BotSkillInput
      onChange={onChange}
      defaultValue={defaultValue}
      skills={provider ? resolveProviderSkillsForCwd(provider, gitCwd) : []}
      scanning={scanning}
      onSearch={refresh}
    />
  );
}

export function BotSkillInput({
  defaultValue,
  onChange,
  skills,
  scanning,
  onSearch,
}: {
  defaultValue: string;
  onChange?: ((path: string) => void) | undefined;
  skills: ReadonlyArray<ServerProviderSkill>;
  scanning: boolean;
  onSearch: () => void;
}) {
  const id = useId();
  const [input, setInput] = useState(defaultValue);
  const selected = skills.find((skill) => skill.path === input) ?? null;
  const query = selected ? "" : input.replace(/^\/(?:skill:)?/, "");
  const matches = searchProviderSkills(skills, query, 50).slice(0, 50);
  return (
    <div className="grid min-w-0 gap-1.5 text-xs font-medium">
      <label htmlFor={id}>Skill</label>
      <Combobox
        items={matches.map((skill) => skill.path)}
        filter={null}
        value={input || null}
        inputValue={input}
        autoHighlight
        onInputValueChange={(value) => {
          setInput(value);
          onChange?.(value);
          onSearch();
        }}
        onValueChange={(path) => {
          if (path) {
            setInput(path);
            onChange?.(path);
          }
        }}
      >
        <ComboboxInput
          id={id}
          name="skillPath"
          required
          maxLength={2048}
          placeholder="Search skills or paste a path"
          onFocus={onSearch}
        />
        <ComboboxPopup className="w-[min(28rem,var(--available-width))]">
          <ComboboxEmpty>
            {scanning ? "Looking for skills…" : "No matching skills. You can paste a skill path."}
          </ComboboxEmpty>
          <ComboboxList>
            {(path: string) => {
              const skill = matches.find((candidate) => candidate.path === path)!;
              return (
                <ComboboxItem key={path} value={path}>
                  <div className="min-w-0">
                    <div className="truncate">{formatProviderSkillDisplayName(skill)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {skill.shortDescription ?? skill.description ?? skill.path}
                    </div>
                  </div>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}
