import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { appAtomRegistry } from "../../rpc/atomRegistry";

export const botSettingsThreadAtom = Atom.make<ScopedThreadRef | null>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("bot:settings-thread"),
);

export function openBotSettings(threadRef: ScopedThreadRef): void {
  appAtomRegistry.set(botSettingsThreadAtom, threadRef);
}
