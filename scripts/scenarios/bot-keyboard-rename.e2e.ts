import { expect } from "e2e";

import { test, WEB } from "./t3.ts";

test("A bot keeps keyboard rename after conversion", WEB, async ({ t3, app, screen, browser }) => {
  const project = await t3.project("bots");
  const thread = await t3.thread({ project, title: "Chief of Staff", messages: ["Check my work"] });
  await t3.open(thread);
  await screen.getByRole("button", "Make this a bot").tap();
  await screen.getByRole("button", "Save bot").tap();
  const bot = screen.getByRole("button", /^Chief of Staff/);
  await bot.tap();
  await browser.keyboard.press("F2");
  await app.screenshot("bot-keyboard-rename");
  await expect(screen.getByRole("textbox", "Thread title")).toBeVisible();
});
