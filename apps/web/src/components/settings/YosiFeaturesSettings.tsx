import { YOSI_FEATURES, useYosiFeatures } from "../../lib/yosiFeatures";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function YosiFeaturesSettings() {
  const [enabled, setEnabled] = useYosiFeatures();

  return (
    <SettingsRow
      {...searchableSetting("yosi-features")}
      description="Turns on all of these together. Off by default, as upstream; turning it off keeps your groups and order for when you turn it back on."
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
          <SettingResetButton label="Yosi features" onClick={() => setEnabled(false)} />
        ) : null
      }
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(Boolean(checked))}
          aria-label="Yosi features"
        />
      }
    />
  );
}
