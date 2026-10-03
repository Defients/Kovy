import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";

export function CircadianTab() {
  const config = useConfigStore((s) => s.draftConfig.circadian);
  const update = useConfigStore((s) => s.updateDraftCircadian);
  const dream = useConfigStore((s) => s.draftConfig.dream);
  const updateDream = useConfigStore((s) => s.updateDraftDream);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <InfoCard title="Circadian Rhythm">
        Kovy adapts to your daily rhythm. It learns when you're active and adjusts its energy,
        drowsiness, and behavior accordingly. Over time, Kovy anticipates your schedule and
        reacts naturally to your patterns.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("circadian")}>
        <SwitchSetting
          label="Circadian rhythm enabled"
          description="Allow Kovy to adapt its behavior to time-of-day patterns learned from your activity"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Adaptation">
            <SliderSetting
              label="Adaptation rate"
              description="How quickly Kovy's internal rhythm adjusts to changes in your activity patterns (lower = more stable, higher = more responsive)"
              value={config.adaptationRate}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ adaptationRate: v })}
              displayValue={`${Math.round(config.adaptationRate * 100)}%`}
            />
            <SliderSetting
              label="Day/night amplification"
              description="How strongly the time-of-day influences Kovy's energy and drowsiness levels"
              value={config.amplifyDayNight}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ amplifyDayNight: v })}
              displayValue={`${Math.round(config.amplifyDayNight * 100)}%`}
            />
          </SettingSection>

          <SettingSection title="Dream & Startle">
            <SwitchSetting
              label="Dream mode"
              description="Allow Kovy to enter a dream state during quiet periods — shows constellation particles and gentle drifting"
              checked={config.dreamEnabled}
              onChange={(v) => update({ dreamEnabled: v })}
            />
            <SwitchSetting
              label="Startle reactions"
              description="Allow Kovy to be startled by sudden screen activity during quiet/drowsy periods"
              checked={config.startleEnabled}
              onChange={(v) => update({ startleEnabled: v })}
            />
            {config.startleEnabled && (
              <SliderSetting
                label="Startle cooldown"
                description="Minimum seconds between startle reactions to avoid constant jumpiness"
                value={config.startleCooldown}
                min={1} max={30} step={1}
                onChange={(v) => update({ startleCooldown: v })}
                displayValue={`${config.startleCooldown}s`}
              />
            )}
          </SettingSection>

          <SettingSection title="Dream Visuals">
            <SwitchSetting
              label="Dream visuals enabled"
              description="Show floating particles and color shifts while Kovy dreams"
              checked={dream.enabled}
              onChange={(v) => updateDream({ enabled: v })}
            />
            {dream.enabled && (
              <>
                <SliderSetting
                  label="Particle density"
                  description="How many dream particles spawn while dreaming"
                  value={dream.particleDensity}
                  min={0} max={1} step={0.05}
                  onChange={(v) => updateDream({ particleDensity: v })}
                  displayValue={`${Math.round(dream.particleDensity * 100)}%`}
                />
                <SliderSetting
                  label="Dream thought frequency"
                  description="How often Kovy shares dream thoughts"
                  value={dream.thoughtFrequency}
                  min={0} max={1} step={0.05}
                  onChange={(v) => updateDream({ thoughtFrequency: v })}
                  displayValue={`${Math.round(dream.thoughtFrequency * 100)}%`}
                />
                <SwitchSetting
                  label="Color wash"
                  description="Apply a subtle hue shift to Kovy during dreams"
                  checked={dream.colorWash}
                  onChange={(v) => updateDream({ colorWash: v })}
                />
                <SliderSetting
                  label="Max dream particles"
                  description="Maximum number of particles on screen while dreaming"
                  value={dream.maxDreamParticles}
                  min={5} max={20} step={1}
                  onChange={(v) => updateDream({ maxDreamParticles: v })}
                  displayValue={`${dream.maxDreamParticles}`}
                />
              </>
            )}
          </SettingSection>
        </>
      )}
    </div>
  );
}
