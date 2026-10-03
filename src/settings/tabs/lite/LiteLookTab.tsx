import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../../components/SettingRow";
import { SliderSetting } from "../../components/SliderSetting";
import { SwitchSetting } from "../../components/SwitchSetting";
import { SelectSetting } from "../../components/SelectSetting";
import { InfoCard } from "../../components/InfoCard";
import type { VisualPreset, EyeStyle } from "@/store/types";

const VISUAL_PRESETS: { value: VisualPreset; label: string; desc: string }[] = [
  { value: "minimal", label: "Minimal", desc: "Clean, lightweight, fewer effects" },
  { value: "balanced", label: "Balanced", desc: "Good visuals, reasonable performance" },
  { value: "high", label: "Fancy", desc: "Rich particles, glow, expressive" },
];

export function LiteLookTab() {
  const config = useConfigStore((s) => s.draftConfig.appearance);
  const update = useConfigStore((s) => s.updateDraftAppearance);
  const applyVisual = useConfigStore((s) => s.applyVisualPresetToDraft);
  const skinPackId = useConfigStore((s) => s.draftConfig.skinPack.activePackId);
  const skinPackActive = skinPackId !== "default";

  return (
    <div className="space-y-2">
      <InfoCard title="Look" accent="violet">
        Control how Kovy looks — size, colors, visual effects, and eye style.
      </InfoCard>

      <SettingSection title="Visual Style">
        <div className="space-y-2 py-1">
          {VISUAL_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => applyVisual(p.value)}
              className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                config.visualPreset === p.value
                  ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                  : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
              }`}
            >
              <div className="text-sm font-medium text-kovy-text">{p.label}</div>
              <div className="text-[10px] text-kovy-text-dim mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Size & Opacity">
        <SliderSetting
          label="Kovy size"
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
      </SettingSection>

      <SettingSection title="Style">
        {skinPackActive && (
          <InfoCard title="Skin pack active" accent="amber">
            Eye style is currently controlled by the active skin pack
            ({""}<span className="text-amber-300">{skinPackId}</span>). Switch to the Default skin pack
            in Skin Packs settings to change it here.
          </InfoCard>
        )}
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
          label="Mood color shift"
          description="Kovy's color changes with its mood"
          checked={config.moodColorShift}
          onChange={(v) => update({ moodColorShift: v })}
        />
        <SwitchSetting
          label="Reduced motion"
          description="Minimize animations for accessibility"
          checked={config.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </SettingSection>
    </div>
  );
}
