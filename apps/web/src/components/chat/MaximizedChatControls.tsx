import { ChevronUp } from "lucide-react";

import { Button } from "../ui/button";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

/** The floating chat's title bar while it shows the conversation; double-click hides it. */
export function FloatingChatHeader(props: { title: string; onCollapse: () => void }) {
  return (
    <div
      className="flex h-9 shrink-0 cursor-default items-center border-b border-border px-3 select-none"
      onDoubleClick={props.onCollapse}
    >
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
    </div>
  );
}

/** Sits above the collapsed floating composer and brings the conversation back. */
export function FloatingChatExpandButton(props: { onExpand: () => void }) {
  return (
    <div className="pointer-events-auto absolute right-3 bottom-full mb-1.5">
      <Button size="xs" variant="outline" onClick={props.onExpand}>
        <ChevronUp />
        Show conversation
      </Button>
    </div>
  );
}
