import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { useRightPanelStore } from "../rightPanelStore";
import type { AppRouter } from "../router";
import { shownTab, panelTabView, startTabHistory } from "./forkTabHistory";

const host = scopeThreadRef(EnvironmentId.make("env"), ThreadId.make("main"));
const hostKey = scopedThreadKey(host);
const shown = () => shownTab(panelTabView(useRightPanelStore.getState().byThreadKey[hostKey]));
const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function setup() {
  localStorage.setItem("t3code:fork-tab-history", "true");
  useRightPanelStore.setState({ byThreadKey: {} });
  const history = createMemoryHistory({ initialEntries: ["/elsewhere", "/env/main"] });
  const router = {
    history,
    state: {
      matches: [
        {
          routeId: "/_chat/$environmentId/$threadId",
          params: { environmentId: "env", threadId: "main" },
        },
      ],
    },
  } as unknown as AppRouter;
  startTabHistory(router);
  return history;
}

describe("startTabHistory", () => {
  it("steps Back and Forward through tab switches, skipping closed tabs", async () => {
    const history = setup();
    const store = useRightPanelStore.getState();

    store.open(host, "diff");
    await settle();
    store.toggle(host, "preview");
    await settle();
    store.open(host, "diff");
    await settle();
    expect(history.length).toBe(5);

    const preview = useRightPanelStore
      .getState()
      .byThreadKey[hostKey]!.surfaces.find((surface) => surface.kind === "preview")!;
    store.closeSurface(host, preview.id);
    await settle();
    expect(history.length).toBe(5);

    history.back();
    expect(shown()).toBeNull();
    expect(history.location.pathname).toBe("/env/main");

    history.forward();
    expect(shown()).toBe("diff");
    history.back();
    history.back();
    expect(history.location.pathname).toBe("/elsewhere");
  });
});
