import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";
import { InfoCard } from "../components/InfoCard";

export function EmoteTab() {
  const config = useConfigStore((s) => s.draftConfig.emote);
  const update = useConfigStore((s) => s.updateDraftEmote);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <InfoCard title="Emote Particles">
        Kovy expresses its mood and reactions through floating emote symbols — hearts when
        playful, stars when celebrating, ZZZs when sleepy, question marks when curious.
        These are Kovy's primary channel for communicating its inner state.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("emote")}>
        <SwitchSetting
          label="Emote particles enabled"
          description="Show floating mood and behavior symbols around Kovy"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Appearance">
            <SliderSetting
              label="Intensity"
              description="How frequently emotes appear and how visible they are (lower = subtle hints, higher = expressive)"
              value={config.intensity}
              min={0.1} max={1} step={0.05}
              onChange={(v) => update({ intensity: v })}
              displayValue={`${Math.round(config.intensity * 100)}%`}
            />
            <SelectSetting
              label="Style"
              description="How emotes are rendered — bubble wraps symbols in a soft circle, raw shows floating symbols directly"
              value={config.style}
              options={[
                { value: "bubble", label: "Bubble" },
                { value: "raw", label: "Raw" },
              ]}
              onChange={(v) => update({ style: v as "bubble" | "raw" })}
            />
            <SliderSetting
              label="Max active"
              description="Maximum number of emote particles visible at once"
              value={config.maxActive}
              min={3} max={12} step={1}
              onChange={(v) => update({ maxActive: v })}
              displayValue={`${config.maxActive}`}
            />
          </SettingSection>
        </>
      )}
    </div>
  );
}
