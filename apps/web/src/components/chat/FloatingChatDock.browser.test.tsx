import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "~/index.css";

import { act, render } from "../../../test/render";
import { FloatingChatDock } from "./FloatingChatDock";
import { FloatingChatHeader } from "./MaximizedChatControls";

function FloatingChat() {
  const [mode, setMode] = useState<"collapsed" | "expanded" | "minimized">("collapsed");
  const presentation = mode === "expanded" ? "expanded" : "collapsed";
  const toggle = () => setMode((current) => (current === "expanded" ? "collapsed" : "expanded"));
  const minimize = () => setMode("minimized");
  return (
    <div className="relative h-[700px] w-[900px] [--workspace-topbar-height:52px]">
      <FloatingChatDock
        presentation={presentation}
        minimized={mode === "minimized"}
        title="Draft thread"
        onMinimize={minimize}
        onRestore={() => setMode("collapsed")}
        className="flex flex-col"
        inert={mode === "minimized"}
        data-testid="column"
        data-mode={mode}
      >
        <FloatingChatHeader
          title="Draft thread"
          expanded={presentation === "expanded"}
          onToggle={toggle}
          onMinimize={minimize}
        />
        <div data-floating-chat-content className="relative flex-1">
          <div data-chat-composer-overlay className="absolute inset-x-0 bottom-0">
            <input data-chat-composer-main-surface aria-label="Draft" className="h-20 w-full" />
          </div>
        </div>
      </FloatingChatDock>
    </div>
  );
}

it("moves and resizes without opening the conversation, cancels interrupted gestures, and restores the draft from the icon", async () => {
  const key = "t3code:floating-chat-placement";
  const previous = localStorage.getItem(key);
  using cleanup = new DisposableStack();
  cleanup.defer(() => {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  });
  localStorage.removeItem(key);
  await using screen = await render(<FloatingChat />);
  const column = screen.getByTestId("column");
  const draft = screen.getByRole("textbox", { name: "Draft" });
  await userEvent.type(draft, "Keep this draft");
  const handle = screen.getByRole("button", { name: "Move floating chat" }).element();
  // Synthetic pointer events have no native pointer capture.
  using _capture = vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const pointer = { bubbles: true, pointerId: 1, isPrimary: true, button: 0 };
  const send = (element: Element, type: string, x: number, y: number) =>
    act(() =>
      element.dispatchEvent(new PointerEvent(type, { ...pointer, clientX: x, clientY: y })),
    );

  await send(handle, "pointerdown", 850, 600);
  await send(handle, "pointermove", 440, 300);
  await send(handle, "pointerup", 440, 300);
  await expect.element(column).toHaveAttribute("data-floating-chat-edge", "left");
  await expect.element(column).toHaveAttribute("data-mode", "collapsed");
  const saved = localStorage.getItem(key);
  expect(JSON.parse(saved!).edge).toBe("left");

  await send(handle, "pointerdown", 440, 300);
  await send(handle, "pointermove", 900, 300);
  await send(handle, "pointercancel", 900, 300);
  await expect.element(column).toHaveAttribute("data-floating-chat-edge", "left");
  expect(localStorage.getItem(key)).toBe(saved);

  const resize = screen.getByRole("separator", { name: "Resize floating chat" }).element();
  await send(resize, "pointerdown", 490, 400);
  await send(resize, "pointerup", 590, 400);
  expect(JSON.parse(localStorage.getItem(key)!).width).toBe(580);
  await expect.element(draft).toHaveValue("Keep this draft");

  await send(resize, "pointerdown", 590, 400);
  await send(resize, "pointermove", 230, 400);
  await send(resize, "pointerup", 230, 400);
  await expect.element(column).toHaveAttribute("data-mode", "minimized");
  await screen.getByRole("button", { name: "Show chat: Draft thread" }).click();
  await expect.element(draft).toHaveValue("Keep this draft");
  expect(getComputedStyle(column.element()).width).toBe("580px");

  await screen.getByRole("button", { name: "Expand conversation" }).click();
  await expect.element(column).toHaveAttribute("data-mode", "expanded");
  await screen.getByRole("button", { name: "Collapse conversation" }).click();
  await expect.element(column).toHaveAttribute("data-mode", "collapsed");
  await screen.getByRole("button", { name: "Expand conversation" }).click();
  await screen.getByRole("button", { name: "Minimize chat" }).click();
  await screen.getByRole("button", { name: "Show chat: Draft thread" }).click();
  await expect.element(draft).toHaveValue("Keep this draft");
  await screen.unmount();
  await using restored = await render(<FloatingChat />);
  await expect
    .element(restored.getByTestId("column"))
    .toHaveAttribute("data-floating-chat-edge", "left");
  expect(restored.getByTestId("column").element().getBoundingClientRect().width).toBe(580);
});
