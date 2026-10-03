import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { InfoCard } from "../components/InfoCard";
import { RitualEngine, RITUAL_DEFS } from "@/engine/ritualEngine";

export function RitualTab() {
  const config = useConfigStore((s) => s.draftConfig.ritual);
  const update = useConfigStore((s) => s.updateDraftRitual);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [engine] = useState(() => new RitualEngine());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const state = engine.getState();
  const pending = engine.getPendingRituals();

  const ritualConfigKeys = [
    "morningGreeting", "lunchCompanion", "afternoonStretch",
    "eveningWinddown", "midnightDream", "returnCelebration", "weekendSpecial",
  ] as const;

  return (
    <div className="space-y-2">
      <InfoCard title="Daily Rituals" accent="cyan">
        Kovy marks the rhythm of your day with small rituals — a morning greeting,
        lunch companionship, an afternoon stretch, an evening wind-down. These create
        a sense of shared time and routine. All local, no notifications beyond the overlay.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("ritual")}>
        <SwitchSetting
          label="Rituals enabled"
          description="Allow Kovy to perform daily ritual behaviors"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <SwitchSetting
          label="Show ritual notifications"
          description="Brief visual cue on the overlay when a ritual fires"
          checked={config.notifyOnRitual}
          onChange={(v) => update({ notifyOnRitual: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          {pending.length > 0 && (
            <SettingSection title="Active Now">
              <div className="px-3 py-2 space-y-1.5">
                {pending.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-cyan-500/5">
                    <span className="text-base">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-kovy-text">{r.title}</div>
                      <div className="text-[10px] text-kovy-text-dim truncate">{r.description}</div>
                    </div>
                    <span className="text-[10px] text-cyan-400 flex-shrink-0">Active</span>
                  </div>
                ))}
              </div>
            </SettingSection>
          )}

          <SettingSection title="Ritual Schedule">
            <div className="px-3 py-2 space-y-1.5">
              {RITUAL_DEFS.map((r) => {
                const configKey = ritualConfigKeys.find(k =>
                  k.toLowerCase().includes(r.id.split("_")[0])
                );
                const isEnabled = configKey ? config[configKey] : true;
                const total = state.totalPerformed[r.id] ?? 0;
                const streak = state.streaks[r.id] ?? 0;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="text-base">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-kovy-text">{r.title}</div>
                      <div className="text-[10px] text-kovy-text-dim truncate">
                        {r.startHour}:00–{r.endHour}:00
                        {r.daysOfWeek && r.daysOfWeek.length > 0 && " · specific days"}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-kovy-text-dim">{total}× performed</div>
                      {streak > 0 && <div className="text-[10px] text-amber-400">{streak} day streak</div>}
                    </div>
                    {configKey && (
                      <SwitchSetting
                        label=""
                        checked={isEnabled}
                        onChange={(v) => configKey && update({ [configKey]: v })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </SettingSection>
        </>
      )}
    </div>
  );
}
