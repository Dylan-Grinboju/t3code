import { useAtom } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

const botViewAtom = Atom.family((key: string) =>
  Atom.make({ activity: false, history: false }).pipe(Atom.withLabel(`bot:view:${key}`)),
);

export function useBotView(threadRef: ScopedThreadRef | null) {
  return useAtom(botViewAtom(threadRef ? scopedThreadKey(threadRef) : "draft"));
}
