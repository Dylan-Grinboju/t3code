import { BotIcon, ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

const FLOATING_CHAT_REVEAL = { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" };

function floatingChatElements(column: HTMLElement) {
  return {
    title: column.querySelector<HTMLElement>("[data-floating-chat-title]"),
    composer: column.querySelector<HTMLElement>("[data-chat-composer-overlay]"),
  };
}

/** Keeps the reveal edge aligned with the moving title; negative sides preserve the shadow. */
function floatingChatClip(visibleHeight: number) {
  return `inset(calc(100% - ${visibleHeight}px) -3rem -3rem -3rem)`;
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
  const titleAnimationRef = useRef<Animation | null>(null);
  const collapsedGeometryRef = useRef<{
    height: number;
    titleTop: number;
    titleInset: number;
  } | null>(null);
  const composerHeightDeltaRef = useRef(0);
  const previousRef = useRef(presentation);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts a Web Animation on the committed DOM before paint
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = presentation;
    const column = columnRef.current;
    if (presentation === "collapsed" && column) {
      const { title, composer } = floatingChatElements(column);
      if (title && composer) {
        const bounds = column.getBoundingClientRect();
        const titleBounds = title.getBoundingClientRect();
        const composerBounds = composer.getBoundingClientRect();
        collapsedGeometryRef.current = {
          height: composerBounds.height,
          titleTop: titleBounds.top - composerBounds.top,
          titleInset: titleBounds.left - bounds.left,
        };
      }
    }
    if (previous === presentation) return;
    animationRef.current?.cancel();
    titleAnimationRef.current?.cancel();
    animationRef.current = null;
    titleAnimationRef.current = null;
    if (presentation !== "expanded" || previous !== "collapsed" || !column) return;
    const geometry = collapsedGeometryRef.current;
    const { title, composer } = floatingChatElements(column);
    if (!geometry || !title || !composer) return;
    composerHeightDeltaRef.current = geometry.height - composer.getBoundingClientRect().height;
    if (prefersReducedMotion()) return;
    const bounds = column.getBoundingClientRect();
    const titleBounds = title.getBoundingClientRect();
    animationRef.current = column.animate(
      {
        clipPath: [
          floatingChatClip(geometry.height - geometry.titleTop),
          floatingChatClip(bounds.bottom - titleBounds.top),
        ],
      },
      FLOATING_CHAT_REVEAL,
    );
    titleAnimationRef.current = title.animate(
      [
        {
          transform: `translate(${geometry.titleInset - (titleBounds.left - bounds.left)}px, ${bounds.bottom - geometry.height + geometry.titleTop - titleBounds.top}px)`,
          width: `${bounds.width - 2 * geometry.titleInset}px`,
        },
        { transform: "translate(0, 0)", width: `${titleBounds.width}px` },
      ],
      FLOATING_CHAT_REVEAL,
    );
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- composer resizes must refresh the collapsed geometry before the next reveal
  }, [presentation, collapsedHeight]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- cancels Web Animations and pending close callbacks when the chat unmounts
  useLayoutEffect(() => {
    return () => {
      animationRef.current?.cancel();
      titleAnimationRef.current?.cancel();
    };
  }, []);

  /** Shrinks the open conversation back into the composer, then runs `commit`. */
  const close = (commit: () => void) => {
    const column = columnRef.current;
    if (presentation !== "expanded" || !column || prefersReducedMotion()) {
      commit();
      return;
    }
    if (animationRef.current?.id === "close") return;
    const { title, composer } = floatingChatElements(column);
    const geometry = collapsedGeometryRef.current;
    if (!title || !composer || !geometry) {
      commit();
      return;
    }
    const clipPath = getComputedStyle(column).clipPath;
    const titleStyle = getComputedStyle(title);
    const titleFrom = { transform: titleStyle.transform, width: titleStyle.width };
    animationRef.current?.cancel();
    titleAnimationRef.current?.cancel();
    const bounds = column.getBoundingClientRect();
    const titleBounds = title.getBoundingClientRect();
    const targetHeight = composer.getBoundingClientRect().height + composerHeightDeltaRef.current;
    const animation = column.animate(
      {
        clipPath: [
          clipPath === "none" ? floatingChatClip(bounds.bottom - titleBounds.top) : clipPath,
          floatingChatClip(targetHeight - geometry.titleTop),
        ],
      },
      { ...FLOATING_CHAT_REVEAL, id: "close", fill: "forwards" },
    );
    titleAnimationRef.current = title.animate(
      [
        titleFrom,
        {
          transform: `translate(${geometry.titleInset - (titleBounds.left - bounds.left)}px, ${bounds.bottom - targetHeight + geometry.titleTop - titleBounds.top}px)`,
          width: `${bounds.width - 2 * geometry.titleInset}px`,
        },
      ],
      { ...FLOATING_CHAT_REVEAL, fill: "forwards" },
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
      data-floating-chat-title
      className="relative z-30 flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-t-xl border-b border-border bg-background pr-1.5 pl-3 select-none"
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
      <ComposerBanner.Root density="comfortable" data-floating-chat-title>
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
