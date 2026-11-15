import * as Schema from "effect/Schema";
import { BotIcon, GripVerticalIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent,
  type RefObject,
} from "react";

import { readLocalStorageValue, writeLocalStorageValue } from "../../hooks/useLocalStorage";
import { observeResize } from "../../lib/observeResize";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  DEFAULT_FLOATING_CHAT,
  FLOATING_CHAT_ICON_SIZE,
  FLOATING_CHAT_MAX_WIDTH,
  FLOATING_CHAT_MIN_WIDTH,
  dockFloatingChat,
  floatingChatBounds,
  floatingChatPosition,
  resizeFloatingChat,
  type FloatingChatPlacement,
} from "./floatingChatGeometry";
import type { MaximizedChatPresentation } from "./MaximizedChatControls";

const STORAGE_KEY = "t3code:floating-chat-placement";
const PlacementSchema = Schema.Struct({
  edge: Schema.Literals(["top", "right", "bottom", "left"]),
  offset: Schema.Finite,
  width: Schema.Finite,
});

type Gesture = {
  pointerId: number;
  x: number;
  y: number;
  placement: FloatingChatPlacement;
  left: number;
  top: number;
  kind: "move" | "left" | "right";
  moved: boolean;
  collapse: boolean;
  next: FloatingChatPlacement;
};

const DragContext = createContext<ComponentProps<"button">>({});

export function FloatingChatDragHandle() {
  const handlers = useContext(DragContext);
  return (
    <button
      type="button"
      aria-label="Move floating chat"
      aria-description="Drag to a screen edge. Arrow keys move along the edge; Alt+arrow changes edges."
      className="flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
      {...handlers}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
}

export function FloatingChatDock({
  presentation,
  minimized,
  title,
  onMinimize,
  onRestore,
  columnRef,
  children,
  className,
  ...props
}: ComponentProps<"div"> & {
  presentation: MaximizedChatPresentation | null;
  minimized: boolean;
  title: string;
  onMinimize: () => void;
  onRestore: () => void;
  columnRef: RefObject<HTMLDivElement | null>;
}) {
  const floating = presentation === "collapsed" || presentation === "expanded";
  const [placement, setPlacement] = useState(() =>
    readLocalStorageValue(STORAGE_KEY, DEFAULT_FLOATING_CHAT, PlacementSchema),
  );
  const [area, setArea] = useState({ width: 0, height: 0, top: 0, composerHeight: 160 });
  const gesture = useRef<Gesture | null>(null);
  const columnHeight = Math.min(640, Math.max(0, area.height - area.top - 24));
  const visibleHeight = presentation === "expanded" ? columnHeight : area.composerHeight;
  const width = Math.max(
    FLOATING_CHAT_MIN_WIDTH,
    Math.min(FLOATING_CHAT_MAX_WIDTH, placement.width),
  );
  const bounds = floatingChatBounds(area, width, visibleHeight);
  const position = floatingChatPosition(placement, bounds);
  const iconBounds = floatingChatBounds(area, FLOATING_CHAT_ICON_SIZE, FLOATING_CHAT_ICON_SIZE);
  const iconPosition = floatingChatPosition(placement, iconBounds);

  const commit = (next: FloatingChatPlacement) => {
    setPlacement(next);
    writeLocalStorageValue(STORAGE_KEY, next, DEFAULT_FLOATING_CHAT, PlacementSchema);
  };

  const start = (event: PointerEvent<HTMLElement>, kind: Gesture["kind"]) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startPosition = minimized ? iconPosition : position;
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      placement,
      ...startPosition,
      kind,
      moved: false,
      collapse: false,
      next: placement,
    };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 3) return;
    current.moved = true;
    if (current.kind === "move") {
      current.next = dockFloatingChat(
        current.placement,
        minimized ? iconBounds : bounds,
        current.left + dx,
        current.top + dy,
      );
    } else {
      const result = resizeFloatingChat(current.placement, area, current.kind, dx);
      current.next = result.placement;
      current.collapse = result.collapse;
    }
    setPlacement(current.next);
  };

  const finish = (event: PointerEvent<HTMLElement>, cancel: boolean) => {
    if (!cancel) move(event);
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (cancel) setPlacement(current.placement);
    else if (current.collapse) {
      commit(current.placement);
      onMinimize();
    } else if (current.moved) commit(current.next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const pointerHandlers = {
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, false),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true),
  };
  const dragHandlers: ComponentProps<"button"> = {
    ...pointerHandlers,
    onPointerDown: (event) => start(event, "move"),
    onClick: (event) => event.stopPropagation(),
    onKeyDown: (event) => {
      const directions = {
        ArrowLeft: [-24, 0],
        ArrowRight: [24, 0],
        ArrowUp: [0, -24],
        ArrowDown: [0, 24],
      } as const;
      if (!(event.key in directions)) return;
      event.preventDefault();
      event.stopPropagation();
      const direction = directions[event.key as keyof typeof directions];
      if (event.altKey) {
        const edges = {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "top",
          ArrowDown: "bottom",
        } as const;
        commit({ ...placement, edge: edges[event.key as keyof typeof edges] });
      } else {
        const horizontal = placement.edge === "top" || placement.edge === "bottom";
        const travel = horizontal ? bounds.travelX : bounds.travelY;
        const delta = horizontal ? direction[0] : direction[1];
        commit({
          ...placement,
          offset: Math.max(0, Math.min(1, placement.offset + delta / Math.max(1, travel))),
        });
      }
    },
  };

  return (
    <DragContext value={dragHandlers}>
      <div
        {...props}
        ref={(node) => {
          columnRef.current = node;
          if (!node || !floating || !node.parentElement) return;
          const parent = node.parentElement;
          const composer = node.querySelector<HTMLElement>("[data-chat-composer-overlay]");
          const inset = node.querySelector<HTMLElement>("[data-floating-chat-inset]");
          const measure = () => {
            const next = {
              width: parent.clientWidth,
              height: parent.clientHeight,
              top: inset ? parseFloat(getComputedStyle(inset).top) || 0 : 0,
              composerHeight: composer?.offsetHeight ?? 160,
            };
            setArea((previous) =>
              previous.width === next.width &&
              previous.height === next.height &&
              previous.top === next.top &&
              previous.composerHeight === next.composerHeight
                ? previous
                : next,
            );
          };
          measure();
          return observeResize(composer ? [parent, composer] : parent, measure);
        }}
        className={cn(
          className,
          floating && "absolute z-40 border border-transparent",
          presentation === "collapsed" && "[&_.chat-composer-lane]:px-0",
          presentation === "expanded" && "[&_.chat-composer-lane]:px-3",
        )}
        style={
          floating
            ? {
                left: position.left,
                top: position.top + bounds.height - columnHeight,
                width: bounds.width,
                height: columnHeight,
              }
            : undefined
        }
        data-floating-chat-edge={floating ? placement.edge : undefined}
        data-floating-chat-vertical-anchor={
          floating
            ? placement.edge === "top"
              ? 0
              : placement.edge === "bottom"
                ? 1
                : Math.max(0, Math.min(1, placement.offset))
            : undefined
        }
      >
        {floating ? (
          <span
            data-floating-chat-inset
            className="pointer-events-none invisible absolute top-(--workspace-topbar-height)"
          />
        ) : null}
        {children}
        {floating && !minimized
          ? (["left", "right"] as const).map((side) => (
              <div
                key={side}
                role="separator"
                aria-label="Resize floating chat"
                aria-orientation="vertical"
                aria-valuemin={Math.min(FLOATING_CHAT_MIN_WIDTH, bounds.width)}
                aria-valuemax={Math.min(FLOATING_CHAT_MAX_WIDTH, area.width - 24)}
                aria-valuenow={Math.round(bounds.width)}
                tabIndex={0}
                className={cn(
                  "pointer-events-auto absolute bottom-0 z-40 w-2 touch-none cursor-ew-resize rounded-full focus-visible:bg-ring/40 focus-visible:outline-none",
                  side === "left" ? "-left-1" : "-right-1",
                  placement.edge === side && "hidden",
                )}
                style={{ height: bounds.height }}
                {...pointerHandlers}
                onPointerDown={(event) => start(event, side)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const result = resizeFloatingChat(
                    placement,
                    area,
                    side,
                    event.key === "ArrowLeft" ? -32 : 32,
                  );
                  commit(result.placement);
                }}
              />
            ))
          : null}
      </div>
      {minimized ? (
        <div className="absolute z-40" style={{ left: iconPosition.left, top: iconPosition.top }}>
          <Button
            variant="glass"
            size="icon-xl"
            aria-label={`Show chat: ${title}`}
            onClick={onRestore}
          >
            <BotIcon />
          </Button>
        </div>
      ) : null}
    </DragContext>
  );
}
