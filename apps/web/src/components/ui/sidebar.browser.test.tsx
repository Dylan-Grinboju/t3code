import "~/index.css";
import { page, userEvent } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";

import { Link } from "@tanstack/react-router";
import { render } from "../../../test/render";
import { Sidebar, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from "./sidebar";

function CollapseFromInside() {
  const { setOpen } = useSidebar();
  return (
    <button type="button" onClick={() => setOpen(false)}>
      Collapse
    </button>
  );
}

function Harness(props: { readonly onResize?: (width: number) => void }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="offcanvas"
        resizable={{
          minWidth: 200,
          maxWidth: 600,
          ...(props.onResize ? { onResize: props.onResize } : {}),
        }}
      >
        <CollapseFromInside />
        <SidebarRail />
      </Sidebar>
      <SidebarTrigger />
    </SidebarProvider>
  );
}

describe("Sidebar", () => {
  it("hands focus to the outside trigger when it collapses around the focused control", async () => {
    await page.viewport(1280, 800);
    await using screen = await render(<Harness />, { router: false /* no routes involved */ });

    await userEvent.click(screen.getByRole("button", { name: "Collapse" }));

    const sidebar = screen.container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
    await vi.waitFor(() => expect(sidebar.inert).toBe(true));
    const trigger = screen.container.querySelector('[data-slot="sidebar-trigger"]');
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("abandons a rail drag when the sidebar collapses mid-drag", async () => {
    await page.viewport(1280, 800);
    const onResize = vi.fn();
    await using screen = await render(<Harness onResize={onResize} />, {
      router: false /* no routes involved */,
    });
    const rail = screen.container.querySelector<HTMLElement>('[data-sidebar="rail"]')!;
    const { left, top } = rail.getBoundingClientRect();
    const pointer = { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientY: top + 10 };
    const dragTo = (clientX: number) => {
      rail.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: left }));
      rail.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX }));
    };
    // A completed drag commits, so the abandoned one below is a real drag too.
    dragTo(left + 40);
    rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: left + 40 }));
    expect(onResize).toHaveBeenCalledTimes(1);

    dragTo(left + 80);
    await userEvent.click(
      screen.container.querySelector<HTMLElement>('[data-slot="sidebar-trigger"]')!,
    );
    rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: left + 80 }));

    expect(onResize).toHaveBeenCalledTimes(1);
  });
});

function DisplaySettingsControls() {
  const { setDisplayMode, setHoverEnabled } = useSidebar();
  return (
    <>
      <button type="button" onClick={() => setDisplayMode("strip")}>
        Use status strip
      </button>
      <button type="button" onClick={() => setHoverEnabled(false)}>
        Turn off hover
      </button>
    </>
  );
}

function DisplayModeHarness() {
  return (
    <SidebarProvider displayModes>
      <Sidebar>
        <Link to="/">Switch chat</Link>
      </Sidebar>
      <SidebarTrigger />
      <DisplaySettingsControls />
      <button type="button" style={{ position: "fixed", left: 600, top: 100 }}>
        Chat content
      </button>
    </SidebarProvider>
  );
}

function storedSidebarPreferences(mode: "strip" | "closed", hover: boolean) {
  const keys = ["t3code:sidebar-display-mode", "t3code:sidebar-hover"];
  const previous = keys.map((key) => localStorage.getItem(key));
  localStorage.setItem(keys[0]!, JSON.stringify(mode));
  localStorage.setItem(keys[1]!, JSON.stringify(hover));
  return {
    [Symbol.dispose]() {
      keys.forEach((key, index) => {
        const value = previous[index];
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
    },
  };
}

describe("Sidebar display modes", () => {
  it.each(["strip", "closed"] as const)(
    "keeps %s mode through hover and chat navigation",
    async (mode) => {
      await page.viewport(1280, 800);
      using _preferences = storedSidebarPreferences(mode, true);
      await using screen = await render(<DisplayModeHarness />, { router: "/before" });
      const wrapper = screen.container.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]')!;
      const edge = screen.container.querySelector<HTMLElement>("[data-sidebar-hover-edge]")!;
      const sidebar = screen.container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
      const gap = screen.container.querySelector<HTMLElement>('[data-slot="sidebar-gap"]')!;
      expect(sidebar.inert).toBe(true);
      expect(gap.getBoundingClientRect().width).toBe(mode === "strip" ? 32 : 0);

      await userEvent.hover(edge);
      await vi.waitFor(() => expect(sidebar.inert).toBe(false));
      expect(wrapper.dataset.sidebarHoverOpen).toBe("true");
      expect(gap.getBoundingClientRect().width).toBe(mode === "strip" ? 32 : 0);
      await userEvent.click(screen.getByRole("link", { name: "Switch chat" }));
      expect(screen.router?.state.location.pathname).toBe("/");
      expect(wrapper.dataset.sidebarMode).toBe(mode);
      expect(localStorage.getItem("t3code:sidebar-display-mode")).toBe(JSON.stringify(mode));

      await userEvent.hover(screen.getByRole("button", { name: "Chat content" }));
      await vi.waitFor(() => expect(sidebar.inert).toBe(true));
      await screen.rerender(<DisplayModeHarness />);
      expect(wrapper.dataset.sidebarMode).toBe(mode);
    },
  );

  it("lets the user change modes and turn hover off without losing the saved choice", async () => {
    await page.viewport(1280, 800);
    using _preferences = storedSidebarPreferences("closed", true);
    await using screen = await render(<DisplayModeHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Use status strip" }));
    expect(localStorage.getItem("t3code:sidebar-display-mode")).toBe('"strip"');
    await userEvent.click(screen.getByRole("button", { name: "Turn off hover" }));
    expect(screen.container.querySelector("[data-sidebar-hover-edge]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(localStorage.getItem("t3code:sidebar-display-mode")).toBe('"strip"');
  });

  it("keeps the mobile drawer independent of the desktop mode", async () => {
    await page.viewport(390, 844);
    using _preferences = storedSidebarPreferences("strip", true);
    await using screen = await render(<DisplayModeHarness />);
    expect(screen.container.querySelector("[data-sidebar-hover-edge]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    await expect.element(page.getByRole("link", { name: "Switch chat" })).toBeVisible();
    expect(localStorage.getItem("t3code:sidebar-display-mode")).toBe('"strip"');
  });
});
