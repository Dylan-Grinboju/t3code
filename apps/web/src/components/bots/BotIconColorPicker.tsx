import { T, useGT, useMessages } from "gt-react";
import { BotGlyph, type ThreadBot } from "@t3tools/contracts";
import { cn } from "../../lib/utils";
import { PROJECT_ICON_COLORS } from "../../projectIconColors";
import { Button } from "../ui/button";
import { BotIcon } from "lucide-react";
import { BotAvatar, botGlyphs } from "./BotIdentity";

export function BotIconColorPicker({
  color,
  glyph,
  onGlyphChange,
  onChange,
}: {
  glyph: ThreadBot["glyph"];
  onGlyphChange: (value: ThreadBot["glyph"]) => void;
  color: ThreadBot["iconColor"];
  onChange: (color: ThreadBot["iconColor"]) => void;
}) {
  const gt = useGT();
  const messages = useMessages();
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium">
        <T>Bot icon</T>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label={gt("Bot icon")}>
        {[undefined, ...BotGlyph.literals].map((value) => {
          const Icon = value ? botGlyphs[value] : BotIcon;
          const label = value ?? "robot";
          return (
            <Button
              key={label}
              type="button"
              size="icon-sm"
              variant={glyph === value ? "outline" : "ghost"}
              aria-label={label}
              title={label}
              aria-pressed={glyph === value}
              onClick={() => onGlyphChange(value)}
            >
              <Icon aria-hidden />
            </Button>
          );
        })}
      </div>
      <div className="text-xs font-medium">
        <T>Icon color</T>
      </div>
      <div className="flex items-center gap-3">
        <BotAvatar glyph={glyph} color={color} />
        <div
          className="flex max-w-64 flex-wrap gap-1"
          role="group"
          aria-label={gt("Bot icon color")}
        >
          {PROJECT_ICON_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={messages(option.label)}
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
          <T>Default</T>
        </Button>
      </div>
    </div>
  );
}
