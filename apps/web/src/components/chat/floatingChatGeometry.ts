export type FloatingChatEdge = "top" | "right" | "bottom" | "left";

export interface FloatingChatPlacement {
  edge: FloatingChatEdge;
  offset: number;
  width: number;
}

export const FLOATING_CHAT_MARGIN = 20;
export const FLOATING_CHAT_FRAME_PADDING = 12;
export const FLOATING_CHAT_MIN_WIDTH = 320;
export const FLOATING_CHAT_MAX_WIDTH = 960;
const FLOATING_CHAT_COLLAPSE_WIDTH = 240;
export const FLOATING_CHAT_ICON_SIZE = 44;
export const DEFAULT_FLOATING_CHAT: FloatingChatPlacement = {
  edge: "bottom",
  offset: 1,
  width: 480,
};

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function floatingChatBounds(
  area: { width: number; height: number; top: number },
  width: number,
  height: number,
) {
  const margin = FLOATING_CHAT_MARGIN;
  const availableWidth = Math.max(0, area.width - margin * 2);
  const availableHeight = Math.max(0, area.height - area.top - margin * 2);
  return {
    left: margin,
    top: area.top + margin,
    width: Math.min(width, availableWidth),
    height: Math.min(height, availableHeight),
    travelX: Math.max(0, availableWidth - width),
    travelY: Math.max(0, availableHeight - height),
  };
}

export function floatingChatPosition(
  placement: FloatingChatPlacement,
  bounds: ReturnType<typeof floatingChatBounds>,
) {
  const offset = clamp(placement.offset, 1);
  return {
    left:
      bounds.left +
      (placement.edge === "left"
        ? 0
        : placement.edge === "right"
          ? bounds.travelX
          : bounds.travelX * offset),
    top:
      bounds.top +
      (placement.edge === "top"
        ? 0
        : placement.edge === "bottom"
          ? bounds.travelY
          : bounds.travelY * offset),
  };
}

export function dockFloatingChat(
  placement: FloatingChatPlacement,
  bounds: ReturnType<typeof floatingChatBounds>,
  left: number,
  top: number,
): FloatingChatPlacement {
  const x = clamp(left - bounds.left, bounds.travelX);
  const y = clamp(top - bounds.top, bounds.travelY);
  const distances = {
    left: x,
    right: bounds.travelX - x,
    top: y,
    bottom: bounds.travelY - y,
  };
  let edge = placement.edge;
  for (const candidate of ["top", "right", "bottom", "left"] as const) {
    if (distances[candidate] < distances[edge]) edge = candidate;
  }
  const horizontal = edge === "top" || edge === "bottom";
  const travel = horizontal ? bounds.travelX : bounds.travelY;
  return {
    ...placement,
    edge,
    offset: travel === 0 ? placement.offset : (horizontal ? x : y) / travel,
  };
}

export function resizeFloatingChat(
  placement: FloatingChatPlacement,
  area: { width: number; height: number; top: number },
  side: "left" | "right",
  delta: number,
) {
  const bounds = floatingChatBounds(area, placement.width, 0);
  const position = floatingChatPosition(placement, bounds);
  const requestedWidth = bounds.width + (side === "left" ? -delta : delta);
  const width = Math.min(
    Math.max(FLOATING_CHAT_MIN_WIDTH, requestedWidth),
    FLOATING_CHAT_MAX_WIDTH,
    Math.max(0, area.width - FLOATING_CHAT_MARGIN * 2),
  );
  const nextBounds = floatingChatBounds(area, width, 0);
  const left = side === "left" ? position.left + bounds.width - width : position.left;
  return {
    placement: {
      ...placement,
      width,
      offset:
        placement.edge === "top" || placement.edge === "bottom"
          ? nextBounds.travelX === 0
            ? placement.offset
            : clamp(left - nextBounds.left, nextBounds.travelX) / nextBounds.travelX
          : placement.offset,
    },
    collapse: requestedWidth <= FLOATING_CHAT_COLLAPSE_WIDTH,
  };
}
