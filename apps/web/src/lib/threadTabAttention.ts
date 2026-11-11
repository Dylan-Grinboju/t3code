import { resolveThreadLastVisitedAt, resolveThreadStatusPill } from "../components/Sidebar.logic";

type ThreadTabStatusInput = Parameters<typeof resolveThreadStatusPill>[0]["thread"];

export function threadTabAttention(
  shell: ThreadTabStatusInput | null,
  localLastVisitedAt?: string,
) {
  return shell === null
    ? null
    : resolveThreadStatusPill({
        thread: {
          ...shell,
          lastVisitedAt: resolveThreadLastVisitedAt(shell.lastVisitedAt, localLastVisitedAt),
        },
      });
}
