import type { ContextMenuSource } from "@t3tools/contracts";

// Chromium uses no button for keyboard context menus and zero clicks for keyboard activation.
export function contextMenuSourceOf(
  event: Pick<MouseEvent, "type" | "button" | "detail">,
): ContextMenuSource {
  return (event.type === "click" ? event.detail === 0 : event.button === -1) ? "keyboard" : "mouse";
}

export function contextMenuTriggerOf(
  event: {
    readonly currentTarget: HTMLElement;
    readonly defaultPrevented: boolean;
    readonly preventDefault: () => void;
    readonly stopPropagation: () => void;
  } & (
    | Pick<KeyboardEvent, "key" | "shiftKey">
    | Pick<MouseEvent, "type" | "button" | "detail" | "clientX" | "clientY">
  ),
) {
  if (event.defaultPrevented) return null;
  const keyEvent = "key" in event;
  if (keyEvent && event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
    return null;
  }
  event.preventDefault();
  event.stopPropagation();
  const source = keyEvent ? "keyboard" : contextMenuSourceOf(event);
  if (keyEvent || (event.clientX === 0 && event.clientY === 0)) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { source, position: { x: bounds.left, y: bounds.bottom } } as const;
  }
  return { source, position: { x: event.clientX, y: event.clientY } } as const;
}
