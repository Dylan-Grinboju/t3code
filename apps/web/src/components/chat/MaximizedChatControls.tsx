import { ChevronDownIcon, MessageSquareIcon } from "lucide-react";

import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

function MinimizeFloatingChatButton(props: { onMinimize: () => void }) {
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Minimize chat"
      onClick={props.onMinimize}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <ChevronDownIcon />
    </Button>
  );
}

/** The open floating chat's title bar; double-click hides the conversation. */
export function FloatingChatHeader(props: {
  title: string;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <div
      className="flex h-9 shrink-0 cursor-default items-center gap-2 border-b border-border pr-1.5 pl-3 select-none"
      onDoubleClick={props.onToggle}
    >
      <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
      <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
    </div>
  );
}

/** Tops the composer while it floats alone; double-click shows the conversation. */
export function FloatingChatTitleBanner(props: {
  title: string;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root density="comfortable">
        <ComposerBanner.Row className="cursor-default select-none" onDoubleClick={props.onToggle}>
          <ComposerBanner.Icon>
            <MessageSquareIcon />
          </ComposerBanner.Icon>
          <ComposerBanner.Content className="truncate font-medium text-foreground">
            {props.title}
          </ComposerBanner.Content>
          <ComposerBanner.Actions>
            <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
          </ComposerBanner.Actions>
        </ComposerBanner.Row>
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

/** Stands in for the minimized floating chat; click brings the composer back. */
export function MinimizedFloatingChatPill(props: { title: string; onRestore: () => void }) {
  return (
    <Button variant="glass" aria-label={`Show chat: ${props.title}`} onClick={props.onRestore}>
      <MessageSquareIcon />
      <span className="max-w-48 truncate text-xs">{props.title}</span>
    </Button>
  );
}
