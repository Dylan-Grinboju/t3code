import { MessageSquareIcon } from "lucide-react";

import { ComposerBanner } from "./ComposerBanner";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

/** The open floating chat's title bar; double-click hides the conversation. */
export function FloatingChatHeader(props: { title: string; onToggle: () => void }) {
  return (
    <div
      className="flex h-9 shrink-0 cursor-default items-center gap-2 border-b border-border px-3 select-none"
      onDoubleClick={props.onToggle}
    >
      <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
    </div>
  );
}

/** Tops the composer while it floats alone; double-click shows the conversation. */
export function FloatingChatTitleBanner(props: { title: string; onToggle: () => void }) {
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
        </ComposerBanner.Row>
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}
