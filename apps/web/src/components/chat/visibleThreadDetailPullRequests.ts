import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { threadPullRequestKeyOf } from "@t3tools/client-runtime/thread-pull-requests";
import { createContext, use, type Dispatch, type SetStateAction } from "react";

import { useStableCallback } from "../../hooks/useStableCallback";

export const VisibleThreadDetailPullRequests = createContext<Dispatch<
  SetStateAction<ReadonlySet<string>>
> | null>(null);

export const ThreadDetailPullRequestSlot = createContext<HTMLDivElement | null>(null);

export function threadDetailPullRequestUrlKey(url: string): string | undefined {
  const parsed = sourceControlClients.parseChangeRequestUrl(url)?.link;
  return parsed === undefined ? undefined : threadPullRequestKeyOf(parsed);
}

export function useVisibleThreadDetailPullRequest(url: string | undefined) {
  const update = use(VisibleThreadDetailPullRequests);
  const key = update && url ? threadDetailPullRequestUrlKey(url) : undefined;

  return useStableCallback((button: HTMLButtonElement | null) => {
    if (!button || !update || key === undefined) return;
    update((keys) => new Set(keys).add(key));
    return () =>
      update((keys) => {
        const remaining = new Set(keys);
        remaining.delete(key);
        return remaining;
      });
  });
}
