import type { ScopedThreadRef } from "@t3tools/contracts";
import { BotHeaderActions } from "../bots/BotHeaderActions";
import { createContext, use, type RefObject } from "react";
import { createPortal } from "react-dom";

import { PanelLayoutControls, type PanelLayoutControlsProps } from "./PanelLayoutControls";

interface ThreadTabDetails {
  /** The tab's title bar; the details popover opens below it. */
  readonly anchor: RefObject<HTMLElement | null>;
  /** Where the tab's chat puts its details toggle. */
  readonly slot: HTMLElement | null;
}

/** Set by a thread tab, so its embedded chat shows its own thread details card. */
export const ThreadTabDetailsContext = createContext<ThreadTabDetails | null>(null);

export function useThreadTabDetails() {
  return use(ThreadTabDetailsContext);
}

export function ThreadTabDetailsToggle({
  slot,
  threadRef,
  ...props
}: PanelLayoutControlsProps & {
  readonly slot: HTMLElement | null;
  readonly threadRef: ScopedThreadRef | null;
}) {
  if (slot === null) return null;
  return createPortal(
    <>
      {threadRef ? <BotHeaderActions threadRef={threadRef} /> : null}
      <PanelLayoutControls
        {...props}
        // The keybinding toggles the main chat's card, not the tab's.
        threadPanelShortcutLabel={null}
        showTerminalControl={false}
        showRightPanelControl={false}
      />
    </>,
    slot,
  );
}
