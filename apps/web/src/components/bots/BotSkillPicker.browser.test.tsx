import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { BotSkillInput } from "./BotSkillPicker";

it("selects a skill by keyboard and submits its path while accepting custom paths", async () => {
  const submit = vi.fn();
  const skills = [
    { name: "review-inbox", path: "/remote/skills/review-inbox/SKILL.md", enabled: true },
    { name: "chief-of-staff", path: "/remote/skills/chief-of-staff/SKILL.md", enabled: true },
    { name: "disabled", path: "/remote/disabled/SKILL.md", enabled: false },
  ];
  await using screen = await render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget).get("skillPath"));
      }}
    >
      <BotSkillInput defaultValue="" skills={skills} scanning={false} onSearch={() => {}} />
      <button type="submit">Save</button>
    </form>,
  );
  const input = screen.getByRole("combobox", { name: "Skill" });
  await userEvent.fill(input, "/review");
  await expect.element(screen.getByRole("option", { name: /review-inbox/ })).toBeVisible();
  await expect
    .element(screen.getByRole("option", { name: /chief-of-staff/ }))
    .not.toBeInTheDocument();
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect.element(input).toHaveValue(skills[0]!.path);
  expect(submit).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).toHaveBeenLastCalledWith(skills[0]!.path);
  await userEvent.fill(input, "~/custom/SKILL.md");
  await userEvent.keyboard("{Escape}{Tab}");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).toHaveBeenLastCalledWith("~/custom/SKILL.md");
});
