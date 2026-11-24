import type { ScopedThreadRef } from "@t3tools/contracts";
import { Schema } from "effect";
import { createContext, use } from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export type ReferencePeekTarget =
  | {
      kind: "file";
      threadRef: ScopedThreadRef;
      cwd: string;
      path: string;
      line?: number;
      title: string;
    }
  | { kind: "thread"; threadRef: ScopedThreadRef; title: string };

export const ReferencePeekContext = createContext<{
  open: (target: ReferencePeekTarget, origin: HTMLElement) => void;
  peekFilesByDefault: boolean;
} | null>(null);

export function usePeekFilesByDefault() {
  return useLocalStorage("t3code:fork-peek-files-by-default", false, Schema.Boolean);
}

export function useReferencePeek() {
  return use(ReferencePeekContext)?.open;
}

export function isPeekClick(
  event: {
    button: number;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  },
  peekByDefault = false,
) {
  return (
    event.button === 0 &&
    event.shiftKey !== peekByDefault &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
