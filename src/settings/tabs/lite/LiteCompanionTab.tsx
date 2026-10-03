import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../../components/SettingRow";
import { SwitchSetting } from "../../components/SwitchSetting";
import { InfoCard } from "../../components/InfoCard";
import { StatsEngine } from "@/engine/statsEngine";
import { BondEngine } from "@/engine/bondEngine";
import { DEFAULT_BOND } from "@/store/defaults";

export function LiteCompanionTab() {
  const statsConfig = useConfigStore((s) => s.draftConfig.stats);
  const bondConfig = useConfigStore((s) => s.draftConfig.bond);
  const milestoneConfig = useConfigStore((s) => s.draftConfig.milestone);
  const updateStats = useConfigStore((s) => s.updateDraftStats);
  const updateBond = useConfigStore((s) => s.updateDraftBond);
  const updateMilestone = useConfigStore((s) => s.updateDraftMilestone);

  const [statsEngine] = useState(() => new StatsEngine());
  const [bondEngine] = useState(() => new BondEngine({ ...DEFAULT_BOND, ...bondConfig }));
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  const statsOutput = statsEngine.update(statsConfig);
  const stats = statsOutput.stats;
  const bondState = bondEngine.getState();

  const bondLevelLabel: Record<string, string> = {
    stranger: "Stranger",
    acquaintance: "Acquaintance",
    companion: "Companion",
    friend: "Friend",
    best_friend: "Best Friend",
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Companion" accent="pink">
        Your relationship with Kovy — bond level, milestones, and activity stats. All data stays local.
      </InfoCard>

      <SettingSection title="Bond Level">
        <div className="py-3 px-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-kovy-text">
              {bondLevelLabel[bondState.bondLevel] ?? "Stranger"}
            </span>
            <span className="text-xs text-kovy-text-dim">{bondState.bondPoints} / 1000</span>
          </div>
          <div className="h-2 bg-kovy-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-kovy-accent to-kovy-cyan rounded-full transition-all duration-500"
              style={{ width: `${Math.min(bondState.bondPoints / 10, 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <div className="text-lg font-semibold text-kovy-text">{bondState.daysTogether}</div>
              <div className="text-[10px] text-kovy-text-dim">Days together</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-kovy-text">{bondState.streakDays}</div>
              <div className="text-[10px] text-kovy-text-dim">Day streak</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-kovy-text">{bondState.totalPokes}</div>
              <div className="text-[10px] text-kovy-text-dim">Pokes</div>
            </div>
          </div>
        </div>
      </SettingSection>

      {statsConfig.enabled && (
        <SettingSection title="Activity Stats">
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="text-center p-2 rounded bg-kovy-surface/30">
              <div className="text-xl font-semibold text-kovy-text">{stats.totalPokes + stats.totalHovers + stats.totalSwipes}</div>
              <div className="text-[10px] text-kovy-text-dim">Interactions</div>
            </div>
            <div className="text-center p-2 rounded bg-kovy-surface/30">
              <div className="text-xl font-semibold text-kovy-text">{stats.daysActive}</div>
              <div className="text-[10px] text-kovy-text-dim">Days active</div>
            </div>
            <div className="text-center p-2 rounded bg-kovy-surface/30">
              <div className="text-xl font-semibold text-kovy-text">{stats.totalEmotes}</div>
              <div className="text-[10px] text-kovy-text-dim">Emotes</div>
            </div>
            <div className="text-center p-2 rounded bg-kovy-surface/30">
              <div className="text-xl font-semibold text-kovy-text">{Math.round(stats.totalFocusMinutes)}</div>
              <div className="text-[10px] text-kovy-text-dim">Focus minutes</div>
            </div>
          </div>
        </SettingSection>
      )}

      <SettingSection title="Settings">
        <SwitchSetting
          label="Stats tracking"
          description="Track activity statistics over time"
          checked={statsConfig.enabled}
          onChange={(v) => updateStats({ enabled: v })}
        />
        <SwitchSetting
          label="Bond system"
          description="Build a relationship with Kovy over time"
          checked={bondConfig.enabled}
          onChange={(v) => updateBond({ enabled: v })}
        />
        <SwitchSetting
          label="Milestone notifications"
          description="Show a visual when Kovy reaches a milestone"
          checked={milestoneConfig.showNotifications}
          onChange={(v) => updateMilestone({ showNotifications: v })}
        />
      </SettingSection>
    </div>
  );
}
