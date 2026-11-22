import { useGT } from "gt-react";
import { YOSI_FEATURES, useYosiFeatures } from "../../lib/yosiFeatures";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

export function YosiFeaturesSettings() {
  const gt = useGT();
  const setting = useSearchableSetting();
  const [enabled, setEnabled] = useYosiFeatures();

  return (
    <SettingsRow
      {...setting("yosi-features")}
      description={gt(
        "Turns on all of these together. Off by default, as upstream; turning it off keeps your groups and order for when you turn it back on.",
      )}
      status={
        <ul className="max-w-2xl list-disc space-y-0.5 pl-4">
          {YOSI_FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="font-medium text-foreground">{feature.title}:</span>{" "}
              {feature.description}
            </li>
          ))}
        </ul>
      }
      resetAction={
        enabled ? (
          <SettingResetButton
            ariaLabel={gt("Reset Yosi features to default")}
            onClick={() => setEnabled(false)}
          />
        ) : null
      }
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(Boolean(checked))}
          aria-label={gt("Yosi features")}
        />
      }
    />
  );
}
