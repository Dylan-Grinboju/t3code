import { BotIcon, ChevronDownIcon, MinusIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";
import { FloatingChatDragHandle } from "./FloatingChatDock";

/** How the thread's chat shows while the right panel is maximized over it. */
export type MaximizedChatPresentation = "collapsed" | "expanded" | "tab";

const FLOATING_CHAT_REVEAL = { duration: 320, easing: "cubic-bezier(0.4, 0, 0.2, 1)" };

function floatingChatElements(column: HTMLElement) {
  return {
    banner: column.querySelector<HTMLElement>("[data-floating-chat-title]"),
    header: column.querySelector<HTMLElement>("[data-floating-chat-header]"),
    composer: column.querySelector<HTMLElement>("[data-chat-composer-overlay]"),
    input: column.querySelector<HTMLElement>("[data-chat-composer-main-surface]"),
    content: column.querySelector<HTMLElement>("[data-floating-chat-content]"),
    surface: column.querySelector<HTMLElement>("[data-floating-chat-surface]"),
  };
}

function floatingChatClip(content: HTMLElement, input: HTMLElement, top: number) {
  const bounds = content.getBoundingClientRect();
  const inputBounds = input.getBoundingClientRect();
  return `inset(${Math.min(top, inputBounds.top) - bounds.top}px ${bounds.right - inputBounds.right}px ${bounds.bottom - inputBounds.bottom}px ${inputBounds.left - bounds.left}px round 0 0 12px 12px)`;
}

function headerPlacement(column: HTMLElement, top: number, left: number, width: number) {
  const bounds = column.getBoundingClientRect();
  return {
    transform: `translate(${left - bounds.left - column.clientLeft}px, ${top - bounds.top - column.clientTop}px)`,
    width: `${width}px`,
  };
}

function bannerPlacement(column: HTMLElement, input: HTMLElement, top: number, inset: number) {
  const inputBounds = input.getBoundingClientRect();
  return headerPlacement(column, top, inputBounds.left + inset, inputBounds.width - 2 * inset);
}

function surfacePlacement(surface: HTMLElement, input: HTMLElement, top: number) {
  const bounds = surface.getBoundingClientRect();
  const inputBounds = input.getBoundingClientRect();
  return {
    transform: `translate(${inputBounds.left - bounds.left}px, ${top - bounds.top}px) scale(${inputBounds.width / bounds.width}, ${(inputBounds.bottom - top) / bounds.height})`,
    opacity: 0,
  };
}

/**
 * Grows the open conversation up out of the floating composer and shrinks it back on close.
 * A clip-path animation, so the timeline lays out once at full height instead of every frame.
 */
export function useFloatingChatReveal(presentation: MaximizedChatPresentation | null) {
  const columnRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const titleAnimationRef = useRef<Animation | null>(null);
  const surfaceAnimationRef = useRef<Animation | null>(null);
  const columnAnimationRef = useRef<Animation | null>(null);
  const collapsedGeometryRef = useRef<{
    composerHeight: number;
    composerBottom: number;
    bannerTop: number;
    bannerInset: number;
  } | null>(null);
  const composerHeightDeltaRef = useRef(0);
  const previousRef = useRef(presentation);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts a Web Animation on the committed DOM before paint
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = presentation;
    const column = columnRef.current;
    if (previous === presentation) return;
    animationRef.current?.cancel();
    titleAnimationRef.current?.cancel();
    surfaceAnimationRef.current?.cancel();
    columnAnimationRef.current?.cancel();
    animationRef.current = null;
    titleAnimationRef.current = null;
    surfaceAnimationRef.current = null;
    columnAnimationRef.current = null;
    if (presentation !== "expanded" || previous !== "collapsed" || !column) return;
    const geometry = collapsedGeometryRef.current;
    const { header, composer, input, content, surface } = floatingChatElements(column);
    if (!geometry || !header || !composer || !input || !content || !surface) return;
    const composerBounds = composer.getBoundingClientRect();
    composerHeightDeltaRef.current = geometry.composerHeight - composerBounds.height;
    if (prefersReducedMotion()) return;
    const headerBounds = header.getBoundingClientRect();
    const bannerTop = composerBounds.bottom - geometry.composerHeight + geometry.bannerTop;
    animationRef.current = content.animate(
      {
        clipPath: [
          floatingChatClip(content, input, bannerTop + headerBounds.height),
          "inset(0px 0px 0px 0px round 0 0 12px 12px)",
        ],
      },
      FLOATING_CHAT_REVEAL,
    );
    titleAnimationRef.current = header.animate(
      [
        bannerPlacement(column, input, bannerTop, geometry.bannerInset),
        { transform: "translate(0, 0)", width: `${headerBounds.width}px` },
      ],
      FLOATING_CHAT_REVEAL,
    );
    surfaceAnimationRef.current = surface.animate(
      [surfacePlacement(surface, input, bannerTop), { transform: "none", opacity: 1 }],
      FLOATING_CHAT_REVEAL,
    );
    columnAnimationRef.current = column.animate(
      {
        transform: [
          `translateY(${geometry.composerBottom - composerBounds.bottom}px)`,
          "translateY(0)",
        ],
      },
      FLOATING_CHAT_REVEAL,
    );
  }, [presentation]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- cancels Web Animations and pending close callbacks when the chat unmounts
  useLayoutEffect(() => {
    return () => {
      animationRef.current?.cancel();
      titleAnimationRef.current?.cancel();
      surfaceAnimationRef.current?.cancel();
      columnAnimationRef.current?.cancel();
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
    const { header, composer, input, content, surface } = floatingChatElements(column);
    const geometry = collapsedGeometryRef.current;
    if (!header || !composer || !input || !content || !surface || !geometry) {
      commit();
      return;
    }
    const clipPath = getComputedStyle(content).clipPath;
    const headerStyle = getComputedStyle(header);
    const headerFrom = { transform: headerStyle.transform, width: headerStyle.width };
    const surfaceStyle = getComputedStyle(surface);
    const surfaceFrom = { transform: surfaceStyle.transform, opacity: surfaceStyle.opacity };
    const columnFrom = getComputedStyle(column).transform;
    animationRef.current?.cancel();
    titleAnimationRef.current?.cancel();
    surfaceAnimationRef.current?.cancel();
    columnAnimationRef.current?.cancel();
    const bounds = column.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const composerBounds = composer.getBoundingClientRect();
    const bannerTop = composerBounds.top - composerHeightDeltaRef.current + geometry.bannerTop;
    const animation = content.animate(
      {
        clipPath: [
          clipPath === "none" ? "inset(0px 0px 0px 0px round 0 0 12px 12px)" : clipPath,
          floatingChatClip(content, input, bannerTop + headerBounds.height),
        ],
      },
      { ...FLOATING_CHAT_REVEAL, id: "close", fill: "forwards" },
    );
    titleAnimationRef.current = header.animate(
      [headerFrom, bannerPlacement(column, input, bannerTop, geometry.bannerInset)],
      { ...FLOATING_CHAT_REVEAL, fill: "forwards" },
    );
    surfaceAnimationRef.current = surface.animate(
      [surfaceFrom, surfacePlacement(surface, input, bannerTop)],
      { ...FLOATING_CHAT_REVEAL, fill: "forwards" },
    );
    const anchor = Number(column.dataset.floatingChatVerticalAnchor ?? 1);
    const collapsedHeight = composerBounds.height + composerHeightDeltaRef.current;
    columnAnimationRef.current = column.animate(
      {
        transform: [
          columnFrom,
          `translateY(${(1 - anchor) * (collapsedHeight - bounds.height)}px)`,
        ],
      },
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

  const open = (commit: () => void) => {
    const column = columnRef.current;
    if (presentation === "collapsed" && column) {
      const { banner, composer, input } = floatingChatElements(column);
      if (banner && composer && input) {
        const bannerBounds = banner.getBoundingClientRect();
        const composerBounds = composer.getBoundingClientRect();
        collapsedGeometryRef.current = {
          composerHeight: composerBounds.height,
          composerBottom: composerBounds.bottom,
          bannerTop: bannerBounds.top - composerBounds.top,
          bannerInset: bannerBounds.left - input.getBoundingClientRect().left,
        };
      }
    }
    commit();
  };

  return { columnRef, open, close };
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
      <MinusIcon />
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
      <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
      <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
        {props.title}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Collapse conversation"
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle();
        }}
      >
        <ChevronDownIcon />
      </Button>
      <FloatingChatDragHandle />
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
            <MinimizeFloatingChatButton onMinimize={props.onMinimize} />
          </ComposerBanner.Icon>
          <ComposerBanner.Content className="truncate font-medium text-foreground">
            {props.title}
          </ComposerBanner.Content>
          <ComposerBanner.Actions>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Expand conversation"
              onClick={(event) => {
                event.stopPropagation();
                props.onToggle();
              }}
            >
              <ChevronDownIcon className="rotate-180" />
            </Button>
            <FloatingChatDragHandle />
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
