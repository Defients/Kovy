import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";
import { InfoCard } from "../components/InfoCard";
import type { WeatherType } from "@/store/types";

const WEATHER_TYPES: { value: WeatherType; label: string }[] = [
  { value: "clear", label: "Clear — no weather particles" },
  { value: "cloudy", label: "Cloudy — soft overcast motes" },
  { value: "rain", label: "Rain — gentle vertical streaks" },
  { value: "storm", label: "Storm — intense rain particles" },
  { value: "snow", label: "Snow — drifting white flakes" },
  { value: "fog", label: "Fog — hazy low-visibility wisps" },
  { value: "aurora", label: "Aurora — shimmering colored waves" },
];

export function AtmosphereTab() {
  const config = useConfigStore((s) => s.draftConfig.atmosphere);
  const update = useConfigStore((s) => s.updateDraftAtmosphere);
  const resetSection = useConfigStore((s) => s.resetSection);
  const weatherConfig = useConfigStore((s) => s.draftConfig.weather);
  const updateWeather = useConfigStore((s) => s.updateDraftWeather);

  return (
    <div className="space-y-2">
      <InfoCard title="Ambient Atmosphere">
        Subtle ambient particles create a living environment around Kovy. Warm motes at dawn,
        crisp sparkles in morning, lazy dust in afternoon, fireflies at dusk, cool wisps at night.
        The atmosphere adapts to Kovy's circadian rhythm and mood.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("atmosphere")}>
        <SwitchSetting
          label="Atmosphere enabled"
          description="Show ambient environmental particles around Kovy"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Appearance">
            <SliderSetting
              label="Density"
              description="How many atmosphere particles are visible (lower = sparse and subtle, higher = rich and immersive)"
              value={config.density}
              min={0.1} max={1} step={0.05}
              onChange={(v) => update({ density: v })}
              displayValue={`${Math.round(config.density * 100)}%`}
            />
            <SelectSetting
              label="Style"
              description="Visual style of atmosphere particles"
              value={config.style}
              options={[
                { value: "organic", label: "Organic — soft dots, wisps, phase-natural shapes" },
                { value: "geometric", label: "Geometric — diamonds, crosses, rings, lines" },
                { value: "minimal", label: "Minimal — dots only, very clean" },
              ]}
              onChange={(v) => update({ style: v as "organic" | "geometric" | "minimal" })}
            />
          </SettingSection>

          <SettingSection title="Synchronization">
            <SwitchSetting
              label="Circadian sync"
              description="Tie atmosphere colors and behavior to the current circadian phase (dawn, morning, dusk, night, etc.)"
              checked={config.circadianSync}
              onChange={(v) => update({ circadianSync: v })}
            />
            <SwitchSetting
              label="Mood sync"
              description="Adjust particle density based on Kovy's current mood (more when excited, fewer when sleepy)"
              checked={config.moodSync}
              onChange={(v) => update({ moodSync: v })}
            />
          </SettingSection>
        </>
      )}

      <SettingSection title="Weather (v6.1)">
        <SwitchSetting
          label="Weather simulation enabled"
          description="Procedural weather affects Kovy's mood and renders ambient particles (rain, snow, fog, aurora, etc.)"
          checked={weatherConfig.enabled}
          onChange={(v) => updateWeather({ enabled: v })}
        />
        {weatherConfig.enabled && (
          <>
            <SliderSetting
              label="Intensity"
              description="Multiplier for weather particle density and mood influence"
              value={weatherConfig.intensity}
              min={0} max={1} step={0.05}
              onChange={(v) => updateWeather({ intensity: v })}
              displayValue={`${Math.round(weatherConfig.intensity * 100)}%`}
            />
            <SliderSetting
              label="Change interval"
              description="Seconds between automatic weather changes (120s–3600s)"
              value={weatherConfig.changeInterval}
              min={120} max={3600} step={60}
              onChange={(v) => updateWeather({ changeInterval: Math.round(v) })}
              displayValue={`${Math.round(weatherConfig.changeInterval / 60)}min`}
            />
            <div className="px-3 py-2">
              <div className="text-[10px] text-kovy-text-dim mb-2">Allowed weather types:</div>
              <div className="flex flex-wrap gap-2">
                {WEATHER_TYPES.map((wt) => {
                  const isAllowed = weatherConfig.allowedTypes.includes(wt.value);
                  return (
                    <button
                      key={wt.value}
                      onClick={() => {
                        const newTypes = isAllowed
                          ? weatherConfig.allowedTypes.filter((t) => t !== wt.value)
                          : [...weatherConfig.allowedTypes, wt.value];
                        updateWeather({ allowedTypes: newTypes });
                      }}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                        isAllowed
                          ? "border-cyan-400/40 bg-cyan-500/10 text-kovy-text"
                          : "border-kovy-border/30 text-kovy-text-dim"
                      }`}
                    >
                      {wt.value}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </SettingSection>
    </div>
  );
}
