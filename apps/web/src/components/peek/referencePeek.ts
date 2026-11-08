import type { ScopedThreadRef } from "@t3tools/contracts";
import { createContext, use } from "react";

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

export const ReferencePeekContext = createContext<((target: ReferencePeekTarget) => void) | null>(
  null,
);

export function useReferencePeek() {
  return use(ReferencePeekContext);
}

export function isPeekClick(event: {
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}) {
  return event.button === 0 && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}
