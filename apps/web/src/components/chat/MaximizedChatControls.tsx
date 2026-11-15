import { BotIcon, ChevronDownIcon, MinusIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { FloatingChatDragHandle } from "./FloatingChatDock";

export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

function MinimizeFloatingChatButton(props: { onMinimize: () => void }) {
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Minimize chat"
      onClick={(event) => {
        event.stopPropagation();
        props.onMinimize();
      }}
    >
      <MinusIcon />
    </Button>
  );
}

export function FloatingChatHeader(props: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <div
      data-floating-chat-header
      className="relative z-30 flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-t-xl border-b border-border bg-background pr-1.5 pl-3 select-none"
      onClick={props.onToggle}
    >
      <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
      <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={props.expanded ? "Collapse conversation" : "Expand conversation"}
        aria-expanded={props.expanded}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle();
        }}
      >
        <ChevronDownIcon className={cn(!props.expanded && "rotate-180")} />
      </Button>
      <FloatingChatDragHandle />
    </div>
  );
}

/** Covers the maximized panel below its tab bar while the conversation is open; a click closes it. */
export function FloatingChatBackdrop(props: { onClose: () => void }) {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-(--workspace-topbar-height) bottom-0 z-40"
      onClick={props.onClose}
    />
  );
}
