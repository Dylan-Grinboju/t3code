import type { ThreadBot } from "@t3tools/contracts";
import { cn } from "../../lib/utils";
import { PROJECT_ICON_COLORS } from "../../projectIconColors";
import { Button } from "../ui/button";
import { BotAvatar } from "./BotIdentity";

export function BotIconColorPicker({
  color,
  onChange,
}: {
  color: ThreadBot["iconColor"];
  onChange: (color: ThreadBot["iconColor"]) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium">Icon color</div>
      <div className="flex items-center gap-3">
        <BotAvatar color={color} />
        <div className="flex max-w-64 flex-wrap gap-1" role="group" aria-label="Bot icon color">
          {PROJECT_ICON_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={color === option.value}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border border-transparent focus-visible:outline-2 focus-visible:outline-ring",
                color === option.value && "border-foreground/64",
              )}
              onClick={() => onChange(option.value)}
            >
              <span className={cn("size-4 rounded-full", option.swatchClassName)} />
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} disabled={!color}>
          Default
        </Button>
      </div>
    </div>
  );
}
