import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { InfoCard } from "../components/InfoCard";
import { MilestoneEngine, MILESTONE_DEFS, type MilestoneCategory } from "@/engine/milestoneEngine";

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  behavior: "Behavior",
  bond: "Bond",
  mood: "Mood",
  feature: "Feature",
  time: "Time",
  audio: "Audio",
  thoughts: "Thoughts",
  seasonal: "Seasonal",
  growth: "Growth",
  focus: "Focus",
  idle: "Idle",
  drag: "Drag",
  stats: "Stats",
  profiles: "Profiles",
};

const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  behavior: "text-cyan-400",
  bond: "text-amber-400",
  mood: "text-pink-400",
  feature: "text-purple-400",
  time: "text-green-400",
  audio: "text-orange-400",
  thoughts: "text-indigo-400",
  seasonal: "text-red-400",
  growth: "text-lime-400",
  focus: "text-blue-400",
  idle: "text-teal-400",
  drag: "text-yellow-400",
  stats: "text-emerald-400",
  profiles: "text-violet-400",
};

export function MilestoneTab() {
  const config = useConfigStore((s) => s.draftConfig.milestone);
  const update = useConfigStore((s) => s.updateDraftMilestone);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [engine] = useState(() => new MilestoneEngine());
  const [, forceUpdate] = useState(0);

  // Refresh display periodically to reflect newly unlocked milestones
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = engine.getStats();
  const allMilestones = engine.getAll();

  // Group by category
  const byCategory: Record<MilestoneCategory, typeof allMilestones> = {
    behavior: [],
    bond: [],
    mood: [],
    feature: [],
    time: [],
    audio: [],
    thoughts: [],
    seasonal: [],
    growth: [],
    focus: [],
    idle: [],
    drag: [],
    stats: [],
    profiles: [],
  };
  for (const m of allMilestones) {
    byCategory[m.def.category].push(m);
  }

  return (
    <div className="space-y-2">
      <InfoCard title="Milestones" accent="amber">
        Kovy tracks significant moments in its life as your desktop companion — first naps,
        bond levels reached, moods experienced, features activated, and time spent together.
        All milestone data is stored locally. No AI, no network, no cloud.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("milestone")}>
        <SwitchSetting
          label="Milestone tracking enabled"
          description="Record significant events and achievements in Kovy's life"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Notifications">
            <SwitchSetting
              label="Show milestone notifications"
              description="Display a brief toast on the overlay when a milestone is unlocked"
              checked={config.showNotifications}
              onChange={(v) => update({ showNotifications: v })}
            />
            <SwitchSetting
              label="Show progress in tray"
              description="Include milestone count in the system tray tooltip"
              checked={config.showProgressInTray}
              onChange={(v) => update({ showProgressInTray: v })}
            />
          </SettingSection>

          <SettingSection title="Progress">
            <div className="px-3 py-3 space-y-3">
              {/* Overall progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-kovy-text-muted">Overall Progress</span>
                  <span className="text-xs font-medium text-kovy-text">
                    {stats.unlockedCount} / {stats.totalMilestones}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-kovy-surface-light overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                    style={{ width: `${(stats.unlockedCount / stats.totalMilestones) * 100}%` }}
                  />
                </div>
              </div>

              {/* Per-category breakdown */}
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((cat) => (
                  <div key={cat} className="text-center">
                    <div className={`text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                      {stats.byCategory[cat].unlocked}/{stats.byCategory[cat].total}
                    </div>
                    <div className="text-[10px] text-kovy-text-dim mt-0.5">
                      {CATEGORY_LABELS[cat]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SettingSection>

          {/* Milestone grid by category */}
          {(Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((cat) => (
            <SettingSection key={cat} title={CATEGORY_LABELS[cat]}>
              <div className="px-3 py-2 space-y-1.5">
                {byCategory[cat].map(({ def, unlockedAt }) => {
                  const isUnlocked = unlockedAt !== null;
                  return (
                    <div
                      key={def.id}
                      className={`flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors ${
                        isUnlocked
                          ? "bg-amber-500/5"
                          : "opacity-50"
                      }`}
                    >
                      <span className={`text-base ${isUnlocked ? "" : "grayscale"}`}>
                        {isUnlocked ? def.icon : "🔒"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${isUnlocked ? "text-kovy-text" : "text-kovy-text-dim"}`}>
                          {def.title}
                        </div>
                        <div className="text-[10px] text-kovy-text-dim truncate">
                          {def.description}
                        </div>
                      </div>
                      {isUnlocked && unlockedAt && (
                        <span className="text-[10px] text-kovy-text-dim flex-shrink-0">
                          {new Date(unlockedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingSection>
          ))}
        </>
      )}
    </div>
  );
}
