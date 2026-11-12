import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ChatImageAttachment, ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ImageIcon, PinIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useAssetUrlState } from "../../assets/assetUrls";
import { useComposerThreadDraft, type DraftId } from "../../composerDraftStore";
import { assistantCitationNavigation } from "../../lib/assistantCitationNavigation";
import {
  resolveThreadDetailRef,
  useQuietThreadShell,
  useTimelineVisibleTurnItems,
} from "../../state/entities";
import {
  collectShelfImages,
  EMPTY_THREAD_SHELF,
  shelfPinKey,
  useThreadShelfStore,
} from "../../threadShelfStore";
import { AttachmentImage } from "../media/AttachmentImage";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { openExpandedImagePreview } from "./ExpandedImageDialog";

function reportShelfWrite(saved: boolean) {
  if (!saved) toastManager.add({ type: "error", title: "Could not save the shelf on this device" });
  return saved;
}

export function ThreadShelf({
  threadRef,
  draftId,
}: {
  threadRef: ScopedThreadRef;
  draftId?: DraftId;
}) {
  // A detail read before the server has the thread 404s and parks it as deleted for this mount.
  const shell = useQuietThreadShell(threadRef);
  const shellExists = shell !== null;
  const items = useTimelineVisibleTurnItems(
    resolveThreadDetailRef(threadRef, { shellExists, waitForShell: true }),
  );
  const images = collectShelfImages(items);
  const draft = useComposerThreadDraft(draftId ?? threadRef);
  const shelf = useThreadShelfStore(
    (state) => state.shelves[scopedThreadKey(threadRef)] ?? EMPTY_THREAD_SHELF,
  );
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(6);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- retains server attachment references in local storage when history pages enter or leave the client
  useEffect(() => {
    reportShelfWrite(useThreadShelfStore.getState().rememberImages(threadRef, images));
  }, [threadRef, images]);
  const pendingImages = draft.images.filter((image) => !shelf.dismissedImages.includes(image.id));
  const savedImages = shelf.images.filter(
    (image) =>
      !shelf.dismissedImages.includes(image.id) &&
      !pendingImages.some((pending) => pending.id === image.id),
  );
  const count = shelf.pins.length + savedImages.length + pendingImages.length;
  return (
    <section
      aria-label="Shelf"
      data-thread-shelf
      className="dropdown-glass overflow-hidden rounded-2xl p-3"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <PinIcon className="size-3.5" aria-hidden />
        <h3>Shelf</h3>
        {count > 0 ? <span className="ml-auto tabular-nums">{count}</span> : null}
      </div>
      <div data-thread-shelf-items className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {count === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Screenshots you add appear here. Select text in a reply and choose Pin to keep it.
          </p>
        ) : null}
        {shelf.pins.map((citation) => (
          <div
            key={shelfPinKey(citation)}
            className="group relative rounded-lg border border-border/60 bg-background/40"
          >
            <button
              type="button"
              aria-label={`Go to pinned text: ${citation.text}`}
              className="block w-full rounded-lg py-2 pr-8 pl-2 text-left text-xs leading-relaxed hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() =>
                void navigate(
                  assistantCitationNavigation(
                    citation,
                    citation.threadId === threadRef.threadId ? shell : null,
                  ),
                )
              }
            >
              <span dir="auto" className="line-clamp-5 whitespace-pre-wrap break-words">
                {citation.text}
              </span>
            </button>
            <div className="absolute top-1 right-1">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Unpin text"
                onClick={() => reportShelfWrite(useThreadShelfStore.getState().unpin(citation))}
              >
                <XIcon />
              </Button>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 empty:hidden">
          {pendingImages.map((image) => (
            <ShelfImage
              key={`draft:${image.id}`}
              threadRef={threadRef}
              image={image}
              previewUrl={image.previewUrl}
            />
          ))}
          {savedImages.slice(0, visibleCount).map((image) => (
            <SavedShelfImage key={image.id} threadRef={threadRef} image={image} />
          ))}
        </div>
        {savedImages.length > visibleCount ? (
          <Button size="xs" variant="ghost" onClick={() => setVisibleCount(visibleCount + 6)}>
            Show more screenshots
          </Button>
        ) : null}
        {shelf.dismissedImages.length > 0 ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={() =>
              reportShelfWrite(useThreadShelfStore.getState().restoreImages(threadRef))
            }
          >
            Restore hidden screenshots
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function SavedShelfImage({
  threadRef,
  image,
}: {
  threadRef: ScopedThreadRef;
  image: ChatImageAttachment;
}) {
  const asset = useAssetUrlState(threadRef.environmentId, {
    _tag: "attachment",
    attachmentId: image.id,
  });
  return (
    <ShelfImage
      threadRef={threadRef}
      image={image}
      previewUrl={asset._tag === "Success" ? asset.url : undefined}
    />
  );
}

function ShelfImage({
  threadRef,
  image,
  previewUrl,
}: {
  threadRef: ScopedThreadRef;
  image: ChatImageAttachment;
  previewUrl?: string | undefined;
}) {
  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        aria-label={`Open screenshot: ${image.name}`}
        disabled={!previewUrl}
        className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/40 hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => {
          if (!previewUrl) return;
          openExpandedImagePreview(scopedThreadKey(threadRef), {
            images: [
              {
                src: previewUrl,
                name: image.name,
                mimeType: image.mimeType,
                ...(image.source ? { source: image.source } : {}),
                actionsSource: {
                  kind: "image",
                  src: previewUrl,
                  name: image.name,
                  ...(!previewUrl.startsWith("blob:") && !previewUrl.startsWith("data:")
                    ? {
                        asset: {
                          environmentId: threadRef.environmentId,
                          resource: { _tag: "attachment", attachmentId: image.id },
                        },
                      }
                    : {}),
                },
              },
            ],
            index: 0,
          });
        }}
      >
        {previewUrl ? (
          <AttachmentImage
            src={previewUrl}
            name={image.name}
            mimeType={image.mimeType}
            alt={image.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </button>
      <div className="absolute top-1 right-1">
        <Button
          size="icon-xs"
          variant="media-close"
          aria-label={`Remove screenshot from shelf: ${image.name}`}
          onClick={() =>
            reportShelfWrite(useThreadShelfStore.getState().dismissImage(threadRef, image.id))
          }
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
