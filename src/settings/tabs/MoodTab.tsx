import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { SliderSetting } from "../components/SliderSetting";
import type { SurfaceMood } from "@/store/types";

export function MoodTab() {
  const config = useConfigStore((s) => s.draftConfig.mood);
  const update = useConfigStore((s) => s.updateDraftMood);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Mood Engine" onReset={() => resetSection("mood")}>
        <SwitchSetting
          label="Mood engine enabled"
          description="Kovy develops moods based on internal state variables"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <SliderSetting
          label="Mood intensity"
          description="How strongly mood affects behavior and appearance"
          value={config.intensity}
          min={0} max={1}
          onChange={(v) => update({ intensity: v })}
        />
        <SliderSetting
          label="Recovery speed"
          description="How quickly negative moods fade"
          value={config.recoverySpeed}
          min={0} max={1}
          onChange={(v) => update({ recoverySpeed: v })}
        />
      </SettingSection>

      <SettingSection title="Thresholds">
        <SliderSetting
          label="Overwhelm threshold"
          description="How much stimulation triggers overwhelm"
          value={config.overwhelmThreshold}
          min={0.2} max={1}
          onChange={(v) => update({ overwhelmThreshold: v })}
        />
        <SliderSetting
          label="Energy baseline"
          description="Kovy's default energy level"
          value={config.energyBaseline}
          min={0} max={1}
          onChange={(v) => update({ energyBaseline: v })}
        />
        <SliderSetting
          label="Sleepiness baseline"
          description="How prone Kovy is to getting sleepy"
          value={config.sleepinessBaseline}
          min={0} max={1}
          onChange={(v) => update({ sleepinessBaseline: v })}
        />
      </SettingSection>

      <SettingSection title="Personality Biases">
        <SliderSetting
          label="Playfulness bias"
          value={config.playfulnessBias}
          min={-1} max={1} step={0.1}
          onChange={(v) => update({ playfulnessBias: v })}
          displayValue={config.playfulnessBias > 0 ? `+${config.playfulnessBias.toFixed(1)}` : config.playfulnessBias.toFixed(1)}
        />
        <SliderSetting
          label="Shyness bias"
          value={config.shynessBias}
          min={-1} max={1} step={0.1}
          onChange={(v) => update({ shynessBias: v })}
          displayValue={config.shynessBias > 0 ? `+${config.shynessBias.toFixed(1)}` : config.shynessBias.toFixed(1)}
        />
        <SliderSetting
          label="Focus bias"
          value={config.focusBias}
          min={-1} max={1} step={0.1}
          onChange={(v) => update({ focusBias: v })}
          displayValue={config.focusBias > 0 ? `+${config.focusBias.toFixed(1)}` : config.focusBias.toFixed(1)}
        />
        <SliderSetting
          label="Random mood drift"
          description="Adds organic variation to mood over time"
          value={config.randomDrift}
          min={0} max={1}
          onChange={(v) => update({ randomDrift: v })}
        />
      </SettingSection>

      <SettingSection title="Override">
        <SelectSetting
          label="Manual mood override"
          description="Force a specific mood (None = automatic)"
          value={config.manualOverride ?? "none"}
          options={[
            { value: "none", label: "None (automatic)" },
            { value: "calm", label: "Calm" },
            { value: "curious", label: "Curious" },
            { value: "playful", label: "Playful" },
            { value: "focused", label: "Focused" },
            { value: "sleepy", label: "Sleepy" },
            { value: "excited", label: "Excited" },
            { value: "overwhelmed", label: "Overwhelmed" },
            { value: "shy", label: "Shy" },
          ]}
          onChange={(v) => update({ manualOverride: v === "none" ? null : v as SurfaceMood })}
        />
      </SettingSection>

      <SettingSection title="Mapping">
        <SwitchSetting
          label="Mood-to-color mapping"
          description="Kovy's color reflects its mood"
          checked={config.moodToColor}
          onChange={(v) => update({ moodToColor: v })}
        />
        <SwitchSetting
          label="Mood-to-particle mapping"
          description="Particle effects change with mood"
          checked={config.moodToParticles}
          onChange={(v) => update({ moodToParticles: v })}
        />
      </SettingSection>
    </div>
  );
}
