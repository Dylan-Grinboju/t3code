import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { act, render } from "../../../test/render";
import { assistantCitationFromLocation } from "../../lib/assistantCitationNavigation";
import { useThreadShelfStore, THREAD_SHELF_STORAGE_KEY } from "../../threadShelfStore";
import { AssistantSelectionToolbar } from "./AssistantSelectionToolbar";
import { ThreadShelf } from "./ThreadShelf";
import "../../index.css";

const entities = vi.hoisted(() => ({ shellExists: true, detailRefs: [] as unknown[] }));
function setup(shellExists = true) {
  entities.shellExists = shellExists;
  entities.detailRefs = [];
}

vi.mock("../../state/entities", () => ({
  useQuietThreadShell: () => (entities.shellExists ? {} : null),
  resolveThreadDetailRef: (ref: unknown, options: { shellExists: boolean }) =>
    options.shellExists ? ref : null,
  useTimelineVisibleTurnItems: (ref: unknown) => {
    entities.detailRefs.push(ref);
    return ref === null ? [] : SHELF_ITEMS;
  },
}));
const SHELF_ITEMS = vi.hoisted(() => [
  {
    item: {
      type: "user_message",
      attachments: [
        {
          type: "image",
          id: "screenshot",
          name: "screen.png",
          mimeType: "image/png",
          sizeBytes: 42,
        },
      ],
    },
  },
]);
vi.mock("../../assets/assetUrls", () => ({ useAssetUrlState: () => ({ _tag: "Loading" }) }));
vi.mock("./ExpandedImageDialog", () => ({ openExpandedImagePreview: vi.fn() }));

const threadRef = {
  environmentId: EnvironmentId.make("shelf-env"),
  threadId: ThreadId.make("shelf-thread"),
};

function Harness() {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div ref={setViewport} className="h-48 overflow-auto p-4">
        <p data-assistant-citation-source="reply-1">A useful passage worth keeping.</p>
      </div>
      <AssistantSelectionToolbar viewport={viewport} threadRef={threadRef} onCite={() => true} />
      <div className="w-72">
        <ThreadShelf threadRef={threadRef} />
      </div>
    </>
  );
}

it("does not read thread detail before the server has the thread", async () => {
  setup(false);
  localStorage.removeItem(THREAD_SHELF_STORAGE_KEY);
  useThreadShelfStore.setState({ shelves: {} });
  await using screen = await render(<ThreadShelf threadRef={threadRef} />, {
    router: "/shelf-env/shelf-thread",
  });
  await expect.element(screen.getByText(/Screenshots you add appear here/)).toBeVisible();
  expect(entities.detailRefs).not.toContainEqual(threadRef);
});

it("pins the selected passage beside Cite, navigates back to its exact source, and unpins it", async () => {
  setup();
  localStorage.removeItem(THREAD_SHELF_STORAGE_KEY);
  useThreadShelfStore.setState({ shelves: {} });
  await using screen = await render(<Harness />, { router: "/shelf-env/shelf-thread" });
  await expect
    .element(screen.getByRole("button", { name: "Open screenshot: screen.png" }))
    .toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Remove screenshot from shelf: screen.png" }),
  );
  await expect
    .element(screen.getByRole("button", { name: "Open screenshot: screen.png" }))
    .not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Restore hidden screenshots" }));
  await expect
    .element(screen.getByRole("button", { name: "Open screenshot: screen.png" }))
    .toBeVisible();
  const source = screen.container.querySelector("[data-assistant-citation-source]")!;
  await userEvent.click(screen.getByText("A useful passage worth keeping.", { exact: true }));
  await act(() => {
    const range = document.createRange();
    range.selectNodeContents(source);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect
    .element(page.getByRole("button", { name: "Cite selection in composer" }))
    .toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Pin selection to shelf" }));
  await expect
    .element(
      screen.getByRole("button", { name: "Go to pinned text: A useful passage worth keeping." }),
    )
    .toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Go to pinned text: A useful passage worth keeping." }),
  );
  await vi.waitFor(() =>
    expect(assistantCitationFromLocation(screen.router!.state.location.href)).toMatchObject({
      ...threadRef,
      messageId: "reply-1",
      text: "A useful passage worth keeping.",
      start: 0,
      end: 31,
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Unpin text" }));
  await expect
    .element(screen.getByRole("button", { name: /Go to pinned text/ }))
    .not.toBeInTheDocument();
});
