import { expect } from "e2e";

import { test, WEB } from "./t3.ts";

test(
  "Bot settings opens and closes at the selected panel speed",
  WEB,
  async ({ t3, app, browser, screen }) => {
    const project = await t3.project("bot-motion");
    const thread = await t3.thread({ project, title: "Bot motion", messages: ["go"] });
    await t3.open("/settings/appearance#panel-animations");
    const slider = screen.getByRole("slider", "Panel animation duration");
    await slider.tap();
    await browser.keyboard.press("Home");
    for (let step = 0; step < 3; step++) await browser.keyboard.press("ArrowRight");
    await expect(screen.getByText("75 ms", { exact: true })).toBeVisible();
    await t3.open(thread);
    await screen.getByRole("button", "Thread actions for Bot motion").tap();
    await browser.evaluate(() => {
      document.addEventListener("transitionrun", (event) => {
        const popup = event.target;
        if (
          event.propertyName !== "opacity" ||
          !(popup instanceof HTMLElement) ||
          popup.dataset.slot !== "dialog-popup"
        )
          return;
        const direction = popup.hasAttribute("data-ending-style") ? "exit" : "enter";
        document.body.setAttribute(
          `data-bot-${direction}`,
          getComputedStyle(popup).transitionDuration,
        );
      });
      return true;
    });
    await screen.getByRole("menuitem", "Make this a bot").tap();
    const dialog = screen.getByRole("dialog", "Make this a bot");
    await expect(dialog).toBeVisible();
    await app.screenshot("bot-settings");
    await screen.getByRole("button", "Cancel", { exact: true }).tap();
    await expect(dialog).not.toBeVisible();
    const durations = await browser.evaluate(() => [
      document.body.dataset.botEnter ?? null,
      document.body.dataset.botExit ?? null,
    ]);
    expect(durations).toEqual(["0.075s", "0.075s"]);
  },
);
