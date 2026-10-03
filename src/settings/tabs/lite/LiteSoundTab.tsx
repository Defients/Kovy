import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../../components/SettingRow";
import { SliderSetting } from "../../components/SliderSetting";
import { SwitchSetting } from "../../components/SwitchSetting";
import { InfoCard } from "../../components/InfoCard";

export function LiteSoundTab() {
  const config = useConfigStore((s) => s.draftConfig.audio);
  const update = useConfigStore((s) => s.updateDraftAudio);

  return (
    <div className="space-y-2">
      <InfoCard title="Sound" accent="amber">
        Control Kovy's sounds — volume, when sounds play, and UI sounds.
      </InfoCard>

      <SettingSection title="Sound Settings">
        <SwitchSetting
          label="Kovy sounds"
          description="Chirps, reactions, and mood sounds"
          checked={config.kovySounds}
          onChange={(v) => update({ kovySounds: v })}
        />
        <SwitchSetting
          label="UI sounds"
          description="Clicks and interaction sounds in settings"
          checked={config.uiSounds}
          onChange={(v) => update({ uiSounds: v })}
        />
        <SliderSetting
          label="Volume"
          value={config.volume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ volume: v })}
          displayValue={`${Math.round(config.volume * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Sound Frequency">
        <SliderSetting
          label="Ambient sounds"
          description="How often Kovy makes ambient sounds"
          value={config.ambientFrequency}
          min={0}
          max={1}
          onChange={(v) => update({ ambientFrequency: v })}
        />
        <SliderSetting
          label="Reaction sounds"
          description="How often Kovy reacts to screen events"
          value={config.reactionFrequency}
          min={0}
          max={1}
          onChange={(v) => update({ reactionFrequency: v })}
        />
        <SliderSetting
          label="Mood sounds"
          description="How often Kovy expresses its mood through sound"
          value={config.moodFrequency}
          min={0}
          max={1}
          onChange={(v) => update({ moodFrequency: v })}
        />
      </SettingSection>
    </div>
  );
}
