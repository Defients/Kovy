import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import type { EyeStyle, VisualPreset, BodyStyle } from "@/store/types";

export function AppearanceTab() {
  const config = useConfigStore((s) => s.draftConfig.appearance);
  const update = useConfigStore((s) => s.updateDraftAppearance);
  const applyVisual = useConfigStore((s) => s.applyVisualPresetToDraft);
  const resetSection = useConfigStore((s) => s.resetSection);
  const skinPackId = useConfigStore((s) => s.draftConfig.skinPack.activePackId);
  const skinPackActive = skinPackId !== "default";

  return (
    <div className="space-y-2">
      <SettingSection title="Preset" onReset={() => resetSection("appearance")}>
        <SelectSetting
          label="Visual fidelity preset"
          description="Quick preset for visual quality and performance tradeoff"
          value={config.visualPreset}
          options={[
            { value: "minimal", label: "Minimal" },
            { value: "balanced", label: "Balanced" },
            { value: "high", label: "High" },
            { value: "ultra", label: "Ultra" },
          ]}
          onChange={(v) => applyVisual(v as VisualPreset)}
        />
      </SettingSection>

      <SettingSection title="Size & Opacity">
        <SliderSetting
          label="Kovy size"
          description="Scale factor for the companion"
          value={config.size}
          min={0.5}
          max={2.0}
          step={0.05}
          onChange={(v) => update({ size: v })}
          displayValue={`${Math.round(config.size * 100)}%`}
        />
        <SliderSetting
          label="Opacity"
          value={config.opacity}
          min={0.3}
          max={1.0}
          step={0.05}
          onChange={(v) => update({ opacity: v })}
          displayValue={`${Math.round(config.opacity * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Effects">
        <SliderSetting
          label="Glow intensity"
          value={config.glowIntensity}
          min={0}
          max={1}
          onChange={(v) => update({ glowIntensity: v })}
        />
        <SliderSetting
          label="Particle amount"
          value={config.particleAmount}
          min={0}
          max={1}
          onChange={(v) => update({ particleAmount: v })}
        />
        <SliderSetting
          label="Trail length"
          value={config.trailLength}
          min={0}
          max={1}
          onChange={(v) => update({ trailLength: v })}
        />
        <SliderSetting
          label="Shadow softness"
          value={config.shadowSoftness}
          min={0}
          max={1}
          onChange={(v) => update({ shadowSoftness: v })}
        />
        <SliderSetting
          label="Emote intensity"
          description="How expressive Kovy's face is"
          value={config.emoteIntensity}
          min={0}
          max={1}
          onChange={(v) => update({ emoteIntensity: v })}
        />
      </SettingSection>

      <SettingSection title="Style">
        {skinPackActive && (
          <InfoCard title="Skin pack is overriding styles" accent="amber">
            Body style and eye style are currently controlled by the active skin pack
            ({""}<span className="text-amber-300">{skinPackId}</span>). Switch to the Default skin pack
            in the Skin Packs tab to use these settings directly.
          </InfoCard>
        )}
        <SelectSetting
          label="Body style"
          description="Classic = round orb, Blob = gelatinous blob with tentacles"
          value={config.bodyStyle}
          options={[
            { value: "classic", label: "Classic (round orb)" },
            { value: "blob", label: "Blob (gelatinous with tentacles)" },
            { value: "ghost", label: "Ghost (wavy floating)" },
            { value: "star", label: "Star (star-shaped)" },
            { value: "crystal", label: "Crystal (faceted gem)" },
          ]}
          onChange={(v) => update({ bodyStyle: v as BodyStyle })}
        />
        <SelectSetting
          label="Eye style"
          value={config.eyeStyle}
          options={[
            { value: "round", label: "Round" },
            { value: "soft", label: "Soft" },
            { value: "narrow", label: "Narrow" },
            { value: "dot", label: "Dot" },
            { value: "sparkle", label: "Sparkle" },
            { value: "heart", label: "Heart" },
            { value: "crescent", label: "Crescent" },
          ]}
          onChange={(v) => update({ eyeStyle: v as EyeStyle })}
        />
        <SwitchSetting
          label="Mood color shifting"
          description="Kovy's color changes with its mood"
          checked={config.moodColorShift}
          onChange={(v) => update({ moodColorShift: v })}
        />
        <SwitchSetting
          label="Reduced motion"
          description="Minimizes animations for accessibility"
          checked={config.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </SettingSection>

      <SettingSection title="Enhancements">
        <SwitchSetting
          label="Accessories"
          description="Auto-triggered hats, crowns, and effects based on mood and weather"
          checked={config.accessoriesEnabled}
          onChange={(v) => update({ accessoriesEnabled: v })}
        />
        <SwitchSetting
          label="Aurora background"
          description="Subtle flowing gradient bands that shift with time of day"
          checked={config.auroraBackground}
          onChange={(v) => update({ auroraBackground: v })}
        />
        <SwitchSetting
          label="Particle bursts"
          description="Sparkle, dust, and heart bursts on behavior changes"
          checked={config.particleBursts}
          onChange={(v) => update({ particleBursts: v })}
        />
      </SettingSection>

      <SettingSection title="Performance">
        <SelectSetting
          label="Render FPS cap"
          value={String(config.renderFpsCap)}
          options={[
            { value: "15", label: "15 FPS" },
            { value: "30", label: "30 FPS" },
            { value: "60", label: "60 FPS" },
            { value: "120", label: "120 FPS" },
          ]}
          onChange={(v) => update({ renderFpsCap: parseInt(v) })}
        />
      </SettingSection>
    </div>
  );
}
