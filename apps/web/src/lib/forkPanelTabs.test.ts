import { describe, expect, it } from "vite-plus/test";

import type { ThreadRightPanelState } from "../rightPanelStore";
import { maximizeNewlyShownPanels } from "./forkPanelTabs";

const browser = { id: "browser:new", kind: "preview", resourceId: null } as const;

function panel(overrides: Partial<ThreadRightPanelState>): ThreadRightPanelState {
  return { isOpen: false, activeSurfaceId: null, surfaces: [], ...overrides };
}

describe("maximizeNewlyShownPanels", () => {
  it("maximizes a panel only when it starts showing a tab", () => {
    const opened = panel({ isOpen: true, surfaces: [browser], activeSurfaceId: browser.id });
    expect(
      maximizeNewlyShownPanels(
        {
          opened,
          firstTab: opened,
          restored: opened,
          empty: panel({ isOpen: true }),
          already: { ...opened, maximized: true },
        },
        {
          opened: panel({ surfaces: [browser] }),
          firstTab: panel({ isOpen: true }),
          restored: { ...opened, maximized: true },
          empty: panel({}),
          already: panel({}),
        },
      ),
    ).toEqual({
      opened: { ...opened, maximized: true },
      firstTab: { ...opened, maximized: true },
    });
  });
});
