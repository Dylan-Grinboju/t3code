import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_FLOATING_CHAT,
  FLOATING_CHAT_MARGIN,
  dockFloatingChat,
  floatingChatBounds,
  floatingChatPosition,
  resizeFloatingChat,
} from "./floatingChatGeometry";

const area = { width: 1200, height: 900, top: 52 };

describe("floating chat geometry", () => {
  it("keeps every dock within the workspace as the conversation and viewport change size", () => {
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      for (const viewport of [area, { width: 300, height: 260, top: 52 }]) {
        for (const height of [44, 160, 640]) {
          const bounds = floatingChatBounds(viewport, 480, height);
          const position = floatingChatPosition(
            { ...DEFAULT_FLOATING_CHAT, edge, offset: 0.6 },
            bounds,
          );
          expect(position.left).toBeGreaterThanOrEqual(FLOATING_CHAT_MARGIN);
          expect(position.top).toBeGreaterThanOrEqual(viewport.top + FLOATING_CHAT_MARGIN);
          expect(position.left + bounds.width).toBeLessThanOrEqual(
            viewport.width - FLOATING_CHAT_MARGIN,
          );
          expect(position.top + bounds.height).toBeLessThanOrEqual(
            viewport.height - FLOATING_CHAT_MARGIN,
          );
          expect(
            position.left === FLOATING_CHAT_MARGIN ||
              position.top === viewport.top + FLOATING_CHAT_MARGIN ||
              position.left + bounds.width === viewport.width - FLOATING_CHAT_MARGIN ||
              position.top + bounds.height === viewport.height - FLOATING_CHAT_MARGIN,
          ).toBe(true);
        }
      }
    }
  });

  it("snaps to the nearest edge and retains the current edge at tied corners", () => {
    const bounds = floatingChatBounds(area, 480, 160);
    expect(dockFloatingChat(DEFAULT_FLOATING_CHAT, bounds, 20, 300).edge).toBe("left");
    expect(dockFloatingChat(DEFAULT_FLOATING_CHAT, bounds, 700, 300).edge).toBe("right");
    expect(dockFloatingChat(DEFAULT_FLOATING_CHAT, bounds, 350, 70).edge).toBe("top");
    expect(dockFloatingChat(DEFAULT_FLOATING_CHAT, bounds, 350, 720).edge).toBe("bottom");
    expect(dockFloatingChat(DEFAULT_FLOATING_CHAT, bounds, 2000, 2000)).toEqual(
      DEFAULT_FLOATING_CHAT,
    );
  });

  it("resizes from either side without moving the opposite side, and recognizes shrinking to an icon", () => {
    const start = { ...DEFAULT_FLOATING_CHAT, offset: 0.5 };
    const before = floatingChatPosition(start, floatingChatBounds(area, start.width, 160));
    for (const side of ["left", "right"] as const) {
      const result = resizeFloatingChat(start, area, side, side === "left" ? -100 : 100);
      const after = floatingChatPosition(
        result.placement,
        floatingChatBounds(area, result.placement.width, 160),
      );
      expect(result.placement.width).toBe(580);
      expect(result.collapse).toBe(false);
      expect(side === "left" ? after.left + 580 : after.left).toBeCloseTo(
        side === "left" ? before.left + 480 : before.left,
      );
    }
    expect(resizeFloatingChat(start, area, "left", 200)).toMatchObject({
      placement: { width: 320 },
      collapse: false,
    });
    expect(resizeFloatingChat(start, area, "left", 250).collapse).toBe(true);
    expect(resizeFloatingChat(start, area, "right", 3000).placement.width).toBe(960);
  });
});
