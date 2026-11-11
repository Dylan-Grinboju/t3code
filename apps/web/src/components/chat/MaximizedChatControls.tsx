import { BotIcon, ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

const FLOATING_CHAT_REVEAL = { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" };

function floatingChatElements(column: HTMLElement) {
  return {
    banner: column.querySelector<HTMLElement>("[data-floating-chat-title]"),
    header: column.querySelector<HTMLElement>("[data-floating-chat-header]"),
    composer: column.querySelector<HTMLElement>("[data-chat-composer-overlay]"),
  };
}

/** Keeps the reveal edge aligned with the moving title; negative sides preserve the shadow. */
function floatingChatClip(visibleHeight: number) {
  return `inset(calc(100% - ${visibleHeight}px) -3rem -3rem -3rem)`;
}

function headerPlacement(column: HTMLElement, top: number, left: number, width: number) {
  const bounds = column.getBoundingClientRect();
  return {
    top: `${top - bounds.top - column.clientTop}px`,
    left: `${left - bounds.left - column.clientLeft}px`,
    width: `${width}px`,
  };
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
    composerHeight: number;
    bannerTop: number;
    bannerLeft: number;
    bannerWidth: number;
  } | null>(null);
  const composerHeightDeltaRef = useRef(0);
  const previousRef = useRef(presentation);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts a Web Animation on the committed DOM before paint
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = presentation;
    const column = columnRef.current;
    if (presentation === "collapsed" && column) {
      const { banner, composer } = floatingChatElements(column);
      if (banner && composer) {
        const bannerBounds = banner.getBoundingClientRect();
        const composerBounds = composer.getBoundingClientRect();
        collapsedGeometryRef.current = {
          composerHeight: composerBounds.height,
          bannerTop: bannerBounds.top - composerBounds.top,
          bannerLeft: bannerBounds.left - column.getBoundingClientRect().left,
          bannerWidth: bannerBounds.width,
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
    const { header, composer } = floatingChatElements(column);
    if (!geometry || !header || !composer) return;
    const composerBounds = composer.getBoundingClientRect();
    composerHeightDeltaRef.current = geometry.composerHeight - composerBounds.height;
    if (prefersReducedMotion()) return;
    const bounds = column.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const bannerTop = composerBounds.bottom - geometry.composerHeight + geometry.bannerTop;
    animationRef.current = column.animate(
      {
        clipPath: [
          floatingChatClip(bounds.bottom - bannerTop),
          floatingChatClip(bounds.bottom - headerBounds.top),
        ],
      },
      FLOATING_CHAT_REVEAL,
    );
    titleAnimationRef.current = header.animate(
      [
        headerPlacement(column, bannerTop, bounds.left + geometry.bannerLeft, geometry.bannerWidth),
        { top: "0px", left: "0px", width: `${headerBounds.width}px` },
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
    const { header, composer } = floatingChatElements(column);
    const geometry = collapsedGeometryRef.current;
    if (!header || !composer || !geometry) {
      commit();
      return;
    }
    const clipPath = getComputedStyle(column).clipPath;
    const headerStyle = getComputedStyle(header);
    const headerFrom = { top: headerStyle.top, left: headerStyle.left, width: headerStyle.width };
    animationRef.current?.cancel();
    titleAnimationRef.current?.cancel();
    const bounds = column.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const composerBounds = composer.getBoundingClientRect();
    const bannerTop = composerBounds.top - composerHeightDeltaRef.current + geometry.bannerTop;
    const animation = column.animate(
      {
        clipPath: [
          clipPath === "none" ? floatingChatClip(bounds.bottom - headerBounds.top) : clipPath,
          floatingChatClip(bounds.bottom - bannerTop),
        ],
      },
      { ...FLOATING_CHAT_REVEAL, id: "close", fill: "forwards" },
    );
    titleAnimationRef.current = header.animate(
      [
        headerFrom,
        headerPlacement(column, bannerTop, bounds.left + geometry.bannerLeft, geometry.bannerWidth),
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
  hidden: boolean;
  onToggle: () => void;
  onMinimize: () => void;
}) {
  return (
    <div
      data-floating-chat-header
      className={cn(
        "relative z-30 flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-t-xl border-b border-border bg-background pr-1.5 pl-3 select-none",
        props.hidden && "invisible",
      )}
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
