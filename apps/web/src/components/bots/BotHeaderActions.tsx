import type { ScopedThreadRef } from "@t3tools/contracts";
import { ListTodoIcon, Settings2Icon } from "lucide-react";
import { useQuietThreadShell } from "../../state/entities";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { BotStatus } from "./BotIdentity";
import { BotSyncButton } from "./BotSyncButton";
import { BotWorkPanel } from "./BotWorkPanel";
import { botStatus, isVisibleBot } from "./botPresentation";
import { openBotSettings } from "./botSettingsState";

export function BotHeaderActions({ threadRef }: { threadRef: ScopedThreadRef }) {
  const shell = useQuietThreadShell(threadRef);
  if (!shell?.bot) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <BotStatus status={botStatus(shell)} />
      {isVisibleBot(shell) && <BotSyncButton threadRef={threadRef} />}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost-muted" size="icon-sm" aria-label="Bot work" title="Bot work" />
          }
        >
          <ListTodoIcon aria-hidden />
        </PopoverTrigger>
        <PopoverPopup align="end" width="lg" padding="none" aria-label="Bot work">
          <BotWorkPanel threadRef={threadRef} />
        </PopoverPopup>
      </Popover>
      <Button
        variant="ghost-muted"
        size="icon-sm"
        aria-label="Bot settings"
        title="Bot settings"
        onClick={() => openBotSettings(threadRef)}
      >
        <Settings2Icon aria-hidden />
      </Button>
    </div>
  );
}
