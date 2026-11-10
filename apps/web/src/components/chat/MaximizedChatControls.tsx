import { BotIcon, ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

const FLOATING_CHAT_REVEAL = { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" };

/** Shows the column's bottom `visibleHeight` px, or all of it; the negative sides keep its shadow. */
function floatingChatClip(visibleHeight: number | null) {
  const top = visibleHeight === null ? "-3rem" : `calc(100% - ${visibleHeight}px)`;
  return `inset(${top} -3rem -3rem -3rem)`;
}

/**
 * Grows the open conversation up out of the floating composer and shrinks it back on close.
 * A clip-path animation, so the timeline lays out once at full height instead of every frame.
 */
export function useFloatingChatReveal(
  presentation: MaximizedChatPresentation | null,
  collapsedHeight: number,
) {
  const columnRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const previousRef = useRef(presentation);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts a Web Animation on the committed DOM before paint
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = presentation;
    if (previous === presentation) return;
    animationRef.current?.cancel();
    animationRef.current = null;
    const column = columnRef.current;
    if (presentation !== "expanded" || previous !== "collapsed" || !column) return;
    if (prefersReducedMotion()) return;
    animationRef.current = column.animate(
      { clipPath: [floatingChatClip(collapsedHeight), floatingChatClip(null)] },
      FLOATING_CHAT_REVEAL,
    );
  }, [presentation, collapsedHeight]);

  /** Shrinks the open conversation back into the composer, then runs `commit`. */
  const close = (commit: () => void) => {
    const column = columnRef.current;
    if (presentation !== "expanded" || !column || prefersReducedMotion()) {
      commit();
      return;
    }
    if (animationRef.current?.id === "close") return;
    animationRef.current?.cancel();
    const animation = column.animate(
      { clipPath: [floatingChatClip(null), floatingChatClip(collapsedHeight)] },
      { ...FLOATING_CHAT_REVEAL, id: "close", fill: "forwards" },
    );
    animationRef.current = animation;
    // A cancelled close rejects `finished`, which leaves the conversation open.
    animation.finished.then(
      () => {
        flushSync(commit);
        animation.cancel();
      },
      () => {},
    );
  };

  return { columnRef, close };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
      <ChevronDownIcon />
    </Button>
  );
}

/** The open floating chat's title bar; click hides the conversation. */
export function FloatingChatHeader(props: {
  title: string;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <div
      className="flex h-9 shrink-0 cursor-pointer items-center gap-2 border-b border-border pr-1.5 pl-3 select-none"
      onClick={props.onToggle}
    >
      <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
      <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
    </div>
  );
}

/** Tops the composer while it floats alone; click shows the conversation. */
export function FloatingChatTitleBanner(props: {
  title: string;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root density="comfortable">
        <ComposerBanner.Row className="cursor-pointer select-none" onClick={props.onToggle}>
          <ComposerBanner.Icon>
            <BotIcon />
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

/** Stands in for the minimized floating chat; click brings the composer back. */
export function MinimizedFloatingChatPill(props: { title: string; onRestore: () => void }) {
  return (
    <Button variant="glass" aria-label={`Show chat: ${props.title}`} onClick={props.onRestore}>
      <BotIcon />
      <span className="max-w-48 truncate text-xs">{props.title}</span>
    </Button>
  );
}
