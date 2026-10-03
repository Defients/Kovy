import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../../components/SettingRow";
import { SliderSetting } from "../../components/SliderSetting";
import { SwitchSetting } from "../../components/SwitchSetting";
import { InfoCard } from "../../components/InfoCard";
import type { BehaviorPreset } from "@/store/types";

const PERSONALITIES: { value: BehaviorPreset; label: string; desc: string; emoji: string }[] = [
  { value: "chill", label: "Chill", desc: "Calm, relaxed, occasional movement", emoji: "🌙" },
  { value: "curious", label: "Curious", desc: "Explores, inspects, follows motion", emoji: "✦" },
  { value: "focus", label: "Focus Buddy", desc: "Stays put, minimal wandering", emoji: "🎯" },
  { value: "goblin", label: "Goblin", desc: "Chaotic, hyper, never stops", emoji: "👹" },
];

export function LitePersonalityTab() {
  const config = useConfigStore((s) => s.draftConfig.behavior);
  const applyBehavior = useConfigStore((s) => s.applyBehaviorPresetToDraft);
  const update = useConfigStore((s) => s.updateDraftBehavior);

  return (
    <div className="space-y-2">
      <InfoCard title="Personality" accent="cyan">
        Choose Kovy's personality and how active it is. This controls movement and curiosity.
      </InfoCard>

      <SettingSection title="Pick a Personality">
        <div className="grid grid-cols-2 gap-2 py-1">
          {PERSONALITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => applyBehavior(p.value)}
              className={`text-left p-3.5 rounded-lg border transition-all duration-200 ${
                config.preset === p.value
                  ? "border-kovy-accent/60 bg-kovy-accent/10 shadow-glow"
                  : "border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-border"
              }`}
            >
              <div className="text-lg mb-1">{p.emoji}</div>
              <div className="text-sm font-medium text-kovy-text">{p.label}</div>
              <div className="text-[10px] text-kovy-text-dim mt-0.5 leading-snug">{p.desc}</div>
            </button>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Activity Level">
        <SliderSetting
          label="Wander amount"
          description="How much Kovy moves around"
          value={config.wanderAmount}
          min={0}
          max={1}
          onChange={(v) => update({ wanderAmount: v })}
        />
        <SliderSetting
          label="Curiosity"
          description="How attracted Kovy is to interesting things"
          value={config.curiosityStrength}
          min={0}
          max={1}
          onChange={(v) => update({ curiosityStrength: v })}
        />
        <SliderSetting
          label="Rest time"
          description="How long Kovy stays in one spot (seconds)"
          value={config.dwellTime}
          min={1}
          max={30}
          step={1}
          onChange={(v) => update({ dwellTime: v })}
          displayValue={`${Math.round(config.dwellTime)}s`}
        />
      </SettingSection>

      <SettingSection title="Interaction">
        <SwitchSetting
          label="Cursor curiosity"
          description="Kovy notices and follows your cursor"
          checked={config.cursorCuriosity}
          onChange={(v) => update({ cursorCuriosity: v })}
        />
        <SliderSetting
          label="Cursor avoid radius"
          description="Distance Kovy keeps from cursor (pixels)"
          value={config.cursorAvoidRadius}
          min={0}
          max={400}
          step={10}
          onChange={(v) => update({ cursorAvoidRadius: v })}
          displayValue={`${Math.round(config.cursorAvoidRadius)}px`}
        />
      </SettingSection>
    </div>
  );
}
