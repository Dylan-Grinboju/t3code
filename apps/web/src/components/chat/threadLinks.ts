import type { OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";

export type ThreadLinkKind = "pull" | "issue" | "commit" | "github" | "jira";

export interface ThreadLink {
  readonly url: string;
  readonly kind: ThreadLinkKind;
  readonly label: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>()[\]{}"'`|]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?*_~]+$/;
const JIRA_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

/** A GitHub or Jira link, keyed by a canonical URL so `/pull/1/files` and `/pull/1` are one entry. */
export function classifyThreadLink(raw: string): ThreadLink | null {
  let url: URL;
  try {
    url = new URL(raw.replace(TRAILING_PUNCTUATION, ""));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "github.com" || host === "www.github.com") {
    const [owner, repo, type, id] = segments;
    if (owner && repo && id) {
      const repoPath = `${owner}/${repo}`;
      if (type === "pull" && /^\d+$/.test(id))
        return {
          kind: "pull",
          label: `${repoPath}#${id}`,
          url: `https://github.com/${repoPath}/pull/${id}`,
        };
      if (type === "issues" && /^\d+$/.test(id))
        return {
          kind: "issue",
          label: `${repoPath}#${id}`,
          url: `https://github.com/${repoPath}/issues/${id}`,
        };
      if (type === "commit" && /^[0-9a-f]{7,40}$/i.test(id))
        return {
          kind: "commit",
          label: `${repoPath}@${id.slice(0, 7)}`,
          url: `https://github.com/${repoPath}/commit/${id}`,
        };
    }
    if (segments.length === 0) return null;
    const href = `https://github.com${url.pathname.replace(/\/$/, "")}${url.search}${url.hash}`;
    return { kind: "github", label: segments.join("/"), url: href };
  }

  const browse = segments.indexOf("browse");
  const key =
    (browse >= 0 ? segments[browse + 1] : undefined) ?? url.searchParams.get("selectedIssue");
  if (key && JIRA_KEY.test(key)) {
    const base = browse >= 0 ? `/${segments.slice(0, browse).join("/")}` : "";
    return {
      kind: "jira",
      label: key,
      url: `${url.origin}${base.replace(/\/$/, "")}/browse/${key}`,
    };
  }
  return null;
}

// Settled items keep their identity across updates, so each message is scanned once.
const linksByItem = new WeakMap<object, ReadonlyArray<ThreadLink>>();

function itemLinks(item: OrchestrationV2ProjectedTurnItem["item"]): ReadonlyArray<ThreadLink> {
  if (item.type !== "user_message" && item.type !== "assistant_message") return [];
  // A reply still streaming can end mid-URL.
  if (item.type === "assistant_message" && item.streaming) return [];
  let links = linksByItem.get(item);
  if (links === undefined) {
    links = (item.text.match(URL_PATTERN) ?? []).flatMap((raw) => classifyThreadLink(raw) ?? []);
    linksByItem.set(item, links);
  }
  return links;
}

/** GitHub and Jira links from the thread's messages, most recently mentioned first. */
export function collectThreadLinks(
  items: ReadonlyArray<OrchestrationV2ProjectedTurnItem>,
): ReadonlyArray<ThreadLink> {
  const seen = new Set<string>();
  const result: ThreadLink[] = [];
  for (let index = items.length - 1; index >= 0; index--) {
    const links = itemLinks(items[index]!.item);
    for (let linkIndex = links.length - 1; linkIndex >= 0; linkIndex--) {
      const link = links[linkIndex]!;
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      result.push(link);
    }
  }
  return result;
}
