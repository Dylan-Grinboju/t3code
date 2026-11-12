import { Schema } from "effect";
import { useEffect } from "react";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { useStableCallback } from "../hooks/useStableCallback";

const TYPE_TO_CITE_KEY = "t3code:fork-type-to-cite";

export function useTypeToCite() {
  return useLocalStorage(TYPE_TO_CITE_KEY, false, Schema.Boolean);
}

function printableKey(event: KeyboardEvent): string | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.key.length !== 1
  ) {
    return null;
  }
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select") !== null)
  ) {
    return null;
  }
  return event.key;
}

let activeHandler: ((text: string) => boolean) | null = null;
let pendingText: string | null = null;

function bufferUntilCommentFocus() {
  pendingText = "";
  const finish = () => {
    pendingText = null;
    clearTimeout(timeout);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("keydown", claimTypeToCite, true);
  };
  const onFocusIn = (event: FocusEvent) => {
    const input = event.target;
    if (
      !(input instanceof HTMLTextAreaElement) ||
      !input.closest("[data-citation-comment-editor]")
    ) {
      return;
    }
    const text = pendingText;
    finish();
    if (!text) return;
    input.setRangeText(text, input.value.length, input.value.length, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const timeout = setTimeout(finish, 1000);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("keydown", claimTypeToCite, true);
}

export function claimTypeToCite(event: KeyboardEvent): boolean {
  const key = printableKey(event);
  if (key === null) return false;
  if (pendingText !== null) {
    pendingText += key;
  } else if (!activeHandler || !key.trim() || !activeHandler(key)) {
    return false;
  } else {
    bufferUntilCommentFocus();
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function useTypeToCiteListener(active: boolean, onType: (text: string) => boolean) {
  const [enabled] = useTypeToCite();
  const handle = useStableCallback(onType);
  const listening = active && enabled;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens for document keydown while a citable selection is showing
  useEffect(() => {
    if (!listening) return;
    activeHandler = handle;
    const onKeyDown = (event: KeyboardEvent) => claimTypeToCite(event);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      if (activeHandler === handle) activeHandler = null;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [handle, listening]);
}
