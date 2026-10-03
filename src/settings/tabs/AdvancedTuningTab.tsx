import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";

export function AdvancedTuningTab() {
  const entityRelations = useConfigStore((s) => s.draftConfig.entityRelations);
  const updateEntityRelations = useConfigStore((s) => s.updateDraftEntityRelations);

  const personalityEvolution = useConfigStore((s) => s.draftConfig.personalityEvolution);
  const updatePersonalityEvolution = useConfigStore((s) => s.updateDraftPersonalityEvolution);

  const celebration = useConfigStore((s) => s.draftConfig.celebration);
  const updateCelebration = useConfigStore((s) => s.updateDraftCelebration);

  return (
    <div className="space-y-2">
      <InfoCard title="Advanced Tuning">
        Fine-tune emergent systems like entity relationships, personality drift,
        and celebration thresholds. These rarely need adjustment.
      </InfoCard>

      <SettingSection title="Entity Relations">
        <SwitchSetting
          label="Enable entity relations"
          description="Allow entities to form friend, rival, mentor, and playmate bonds"
          checked={entityRelations.enabled}
          onChange={(v) => updateEntityRelations({ enabled: v })}
        />
        <SwitchSetting
          label="Auto-evolve relations"
          description="Let relationship strengths change automatically over time"
          checked={entityRelations.autoEvolve}
          onChange={(v) => updateEntityRelations({ autoEvolve: v })}
        />
        <div className="pt-2">
          <p className="text-sm font-medium mb-1">Current relationships</p>
          {entityRelations.relationships.length === 0 ? (
            <p className="text-sm text-zinc-400">No relations recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-zinc-300">
              {entityRelations.relationships.map((rel, i) => (
                <li key={i} className="flex justify-between">
                  <span>{rel.entityA} — {rel.type} — {rel.entityB}</span>
                  <span className="text-zinc-400">{Math.round(rel.strength * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingSection>

      <SettingSection title="Personality Evolution">
        <SwitchSetting
          label="Enable personality evolution"
          description="Let Kovy's personality slowly drift based on mood history"
          checked={personalityEvolution.enabled}
          onChange={(v) => updatePersonalityEvolution({ enabled: v })}
        />
        <SliderSetting
          label="Evolution rate"
          description="How fast the personality drifts over time"
          value={personalityEvolution.evolutionRate}
          min={0} max={1} step={0.01}
          onChange={(v) => updatePersonalityEvolution({ evolutionRate: v })}
          displayValue={`${Math.round(personalityEvolution.evolutionRate * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Celebration">
        <SwitchSetting
          label="Enable celebrations"
          description="Show celebration reactions for focus milestones and returns"
          checked={celebration.enabled}
          onChange={(v) => updateCelebration({ enabled: v })}
        />
        <SliderSetting
          label="Focus threshold"
          description="Minutes of focused work before triggering a celebration"
          value={celebration.focusThreshold}
          min={1} max={120} step={1}
          onChange={(v) => updateCelebration({ focusThreshold: v })}
          displayValue={`${celebration.focusThreshold} min`}
        />
        <SliderSetting
          label="Return threshold"
          description="Hours of absence before a return celebration"
          value={celebration.returnThreshold}
          min={1} max={72} step={1}
          onChange={(v) => updateCelebration({ returnThreshold: v })}
          displayValue={`${celebration.returnThreshold} h`}
        />
        <SwitchSetting
          label="Weekend celebration"
          description="Enable extra celebration behavior on weekends"
          checked={celebration.weekendCelebration}
          onChange={(v) => updateCelebration({ weekendCelebration: v })}
        />
      </SettingSection>
    </div>
  );
}
