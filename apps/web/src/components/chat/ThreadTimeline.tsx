import type { ThreadBot, ScopedThreadRef } from "@t3tools/contracts";
import { type ComponentProps, useLayoutEffect, useState } from "react";
import { useIncrementalTimelineEntries } from "../../hooks/useIncrementalTimelineEntries";
import type { TimelineEntriesInput, TimelineEntry } from "../../session-logic";
import { useTimelineVisibleTurnItems } from "../../state/entities";
import {
  peekRememberedThreadTimeline,
  rememberReadyThreadTimeline,
  resolveThreadSwitchTimeline,
  timelineHasEphemeralPreviewUrls,
} from "../ChatView.logic";
import { BotControls } from "./BotControls";
import { quietBotEntries } from "./botTimeline";
import { MessagesTimeline } from "./MessagesTimeline";

/**
 * The timeline with the streamed text. ChatView reads the thread through its quiet
 * atoms, which hold through text deltas; this reads the live turn items, so a
 * reasoning delta re-renders the timeline without re-rendering ChatView. Streamed
 * assistant text reaches only its own row, through useAssistantMessageText.
 */
export function ThreadTimeline({
  threadDetailRef,
  entriesInput,
  draftEntries,
  activeThreadKey,
  syncing,
  detailLoading,
  bot,
  ...timelineProps
}: Omit<ComponentProps<typeof MessagesTimeline>, "timelineEntries"> & {
  /** Null until the thread's detail may load; see resolveThreadDetailRef. */
  threadDetailRef: ScopedThreadRef | null;
  entriesInput: Omit<TimelineEntriesInput, "visibleTurnItems">;
  /** A local draft's optimistic rows; null for a server thread. */
  draftEntries: ReadonlyArray<TimelineEntry> | null;
  activeThreadKey: string | null;
  syncing: boolean;
  detailLoading: boolean;
  bot?: ThreadBot | null | undefined;
}) {
  const [view, setView] = useState({ key: activeThreadKey, activity: false, history: false });
  const activity = view.key === activeThreadKey && view.activity;
  const history = view.key === activeThreadKey && view.history;
  const visibleTurnItems = useTimelineVisibleTurnItems(threadDetailRef);
  const serverEntries = useIncrementalTimelineEntries(activeThreadKey, {
    ...entriesInput,
    visibleTurnItems,
  });
  const entries = draftEntries ?? serverEntries;
  const displayedEntries = resolveThreadSwitchTimeline({
    loading: entries.length === 0 && syncing,
    activeThreadKey,
    nextEntries: entries,
    rememberedForActive: peekRememberedThreadTimeline<typeof entries>(activeThreadKey),
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- stores the committed ready timeline in the module-level cache used during thread switches
  useLayoutEffect(() => {
    if (detailLoading || entries.length === 0 || timelineHasEphemeralPreviewUrls(entries)) {
      return;
    }
    rememberReadyThreadTimeline({ threadKey: activeThreadKey, entries });
  }, [activeThreadKey, detailLoading, entries]);
  return (
    <>
      {threadDetailRef && (
        <BotControls
          key={activeThreadKey}
          threadRef={threadDetailRef}
          bot={bot}
          canOperate={timelineProps.canOperateThread === true}
          activity={activity}
          history={history}
          onActivity={() => setView({ key: activeThreadKey, activity: !activity, history })}
          onHistory={() => setView({ key: activeThreadKey, activity, history: !history })}
        />
      )}
      <MessagesTimeline
        {...timelineProps}
        timelineEntries={
          bot && !activity ? quietBotEntries(displayedEntries, history) : displayedEntries
        }
      />
    </>
  );
}
