import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { useRightPanelStore } from "../../rightPanelStore";
import { MarkdownFileLink } from "../chat/MarkdownFileLink";
import { ThreadContextChip } from "../ThreadContextChip";
import { ReferencePeekProvider } from "./ReferencePeekProvider";
import { useReferencePeek } from "./referencePeek";
import "../../index.css";

vi.mock("../files/projectFilesQueryState", () => ({
  useProjectFileQuery: () => ({
    data: { contents: "first line\nsecond line", truncated: false },
    error: null,
  }),
}));
vi.mock("../ChatMarkdown", () => ({ default: ({ text }: { text: string }) => <p>{text}</p> }));
vi.mock("../../state/entities", () => ({
  useThreadVisibleTurnItems: () => [
    { item: { type: "user_message", messageId: "question", text: "What was the decision?" } },
    { item: { type: "assistant_message", messageId: "reply", text: "Keep the smaller design." } },
  ],
  useThreadShell: () => null,
  useProject: () => null,
}));
vi.mock("../../state/threads", () => ({
  useEnvironmentThread: () => ({
    status: "live",
    data: Option.some({ thread: { projectId: "project", worktreePath: "/repo" } }),
    error: Option.none(),
  }),
}));

const threadRef = {
  environmentId: EnvironmentId.make("peek-env"),
  threadId: ThreadId.make("origin"),
};

function FileReference({ source = threadRef }: { source?: typeof threadRef }) {
  const peek = useReferencePeek();
  return (
    <MarkdownFileLink
      environmentId={threadRef.environmentId}
      threadRef={threadRef}
      href="/repo/sample.ts"
      targetPath="/repo/sample.ts"
      iconPath="sample.ts"
      workspaceRelativePath="sample.ts"
      panelPath="sample.ts"
      label="sample.ts"
      copyMarkdown="sample.ts"
      theme="dark"
      line={2}
      openInEditorMenuLabel="Open in editor"
      onOpenInPanel={(path, line) => useRightPanelStore.getState().openFile(threadRef, path, line)}
      resolveCopyPaths={async () => ({ relativePath: "sample.ts", fullPath: "/repo/sample.ts" })}
      onPeek={() =>
        peek?.({
          kind: "file",
          threadRef: source,
          cwd: "/repo",
          path: "sample.ts",
          line: 2,
          title: "sample.ts",
        })
      }
    />
  );
}

it("peeks on Shift-click without opening a panel, dismisses on Escape, and promotes only on Open", async () => {
  await using screen = await render(
    <ReferencePeekProvider>
      <FileReference />
    </ReferencePeekProvider>,
    { router: "/peek-env/origin" },
  );
  using openFile = vi.spyOn(useRightPanelStore.getState(), "openFile");
  const file = screen.getByRole("link");
  await userEvent.keyboard("{Shift>}");
  await userEvent.click(file);
  await userEvent.keyboard("{/Shift}");
  await expect.element(page.getByRole("dialog", { name: "Peek: sample.ts" })).toBeVisible();
  await expect.element(page.getByText("second line", { exact: true })).toBeVisible();
  expect(openFile).not.toHaveBeenCalled();
  expect(screen.router!.state.location.pathname).toBe("/peek-env/origin");
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await userEvent.keyboard("{Shift>}");
  await userEvent.click(file);
  await userEvent.keyboard("{/Shift}");
  await userEvent.click(page.getByRole("button", { name: "Open in panel" }));
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(openFile).toHaveBeenCalledWith(threadRef, "sample.ts", 2);
  openFile.mockClear();
  await userEvent.click(file);
  expect(openFile).toHaveBeenCalledWith(threadRef, "sample.ts", 2);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

it("reads a referenced thread without navigating until Open thread is pressed", async () => {
  await using screen = await render(
    <ReferencePeekProvider>
      <ThreadContextChip
        record={{ ...threadRef, threadId: ThreadId.make("other"), title: "Design notes" }}
      />
    </ReferencePeekProvider>,
    { router: "/peek-env/origin" },
  );
  await userEvent.keyboard("{Shift>}");
  await userEvent.click(screen.getByRole("link", { name: "Thread, Design notes" }));
  await userEvent.keyboard("{/Shift}");
  await expect.element(page.getByRole("dialog", { name: "Peek: Design notes" })).toBeVisible();
  await expect.element(page.getByText("Keep the smaller design.")).toBeVisible();
  expect(screen.router!.state.location.pathname).toBe("/peek-env/origin");
  await userEvent.click(page.getByRole("button", { name: "Open thread", exact: true }));
  await vi.waitFor(() => expect(screen.router!.state.location.pathname).toBe("/peek-env/other"));
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

it("promotes a file from a peeked thread into that thread's panel", async () => {
  const source = { ...threadRef, threadId: ThreadId.make("other") };
  await using screen = await render(
    <ReferencePeekProvider>
      <FileReference source={source} />
    </ReferencePeekProvider>,
    { router: "/peek-env/origin" },
  );
  using openFile = vi.spyOn(useRightPanelStore.getState(), "openFile");
  await userEvent.keyboard("{Shift>}");
  await userEvent.click(screen.getByRole("link"));
  await userEvent.keyboard("{/Shift}");
  await expect.element(page.getByRole("dialog", { name: "Peek: sample.ts" })).toBeVisible();
  expect(screen.router!.state.location.pathname).toBe("/peek-env/origin");
  await userEvent.click(page.getByRole("button", { name: "Open in panel" }));
  await vi.waitFor(() => expect(screen.router!.state.location.pathname).toBe("/peek-env/other"));
  expect(openFile).toHaveBeenCalledWith(source, "sample.ts", 2);
});
