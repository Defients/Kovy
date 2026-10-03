import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { StatsEngine } from "@/engine/statsEngine";
import { loadSnapshots, clearSnapshots } from "@/engine/chronicleStorage";
import { buildTrends, summarizeChronicle } from "@/engine/chronicleEngine";

export function StatsTab() {
  const config = useConfigStore((s) => s.draftConfig.stats);
  const update = useConfigStore((s) => s.updateDraftStats);
  const resetSection = useConfigStore((s) => s.resetSection);
  const digest = useConfigStore((s) => s.draftConfig.digest);
  const updateDigest = useConfigStore((s) => s.updateDraftDigest);
  const chronicle = useConfigStore((s) => s.draftConfig.chronicle);
  const updateChronicle = useConfigStore((s) => s.updateDraftChronicle);

  const [engine] = useState(() => new StatsEngine());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    const output = engine.update(config);
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), stats: output.stats }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kovy-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const output = engine.update(config);
  const stats = output.stats;

  return (
    <div className="space-y-2">
      <InfoCard title="Statistics" accent="green">
        Kovy tracks usage statistics locally — interactions, time together, focus minutes,
        emotes, and more. All data stays on your device.
      </InfoCard>

      <SwitchSetting
        label="Enable Stats Tracking"
        description="Collect usage statistics over time"
        checked={config.enabled}
        onChange={(v) => update({ enabled: v })}
      />

      {config.enabled && (
        <>
          <SettingSection title="Tracking Level">
            <div className="flex gap-2">
              {(["minimal", "standard", "detailed"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => update({ trackingLevel: level })}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    config.trackingLevel === level
                      ? "bg-kovy-accent/20 text-kovy-accent border border-kovy-accent/40"
                      : "bg-kovy-surface/50 text-kovy-text-dim border border-kovy-border/30 hover:border-kovy-border/60"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </SettingSection>

          <SettingSection title="Overview">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total Pokes" value={stats.totalPokes} icon="👋" />
              <StatCard label="Total Hovers" value={stats.totalHovers} icon="�" />
              <StatCard label="Total Swipes" value={stats.totalSwipes} icon="💫" />
              <StatCard label="Focus Minutes" value={stats.totalFocusMinutes} icon="�" />
              <StatCard label="Idle Minutes" value={stats.totalIdleMinutes} icon="😴" />
              <StatCard label="Gaming Sessions" value={stats.totalGamingSessions} icon="🎮" />
              <StatCard label="Emotes Spawned" value={stats.totalEmotes} icon="♥" />
              <StatCard label="Thoughts" value={stats.totalThoughts} icon="💭" />
              <StatCard label="Whispers" value={stats.totalWhispers} icon="💬" />
              <StatCard label="Days Active" value={stats.daysActive} icon="📅" />
              <StatCard label="Longest Focus" value={`${stats.longestFocusSession}m`} icon="🏆" />
            </div>
          </SettingSection>

          <button
            onClick={handleExport}
            className="px-4 py-2 rounded text-sm font-medium bg-kovy-accent/20 text-kovy-accent border border-kovy-accent/40 hover:bg-kovy-accent/30 transition-colors"
          >
            📥 Export Stats as JSON
          </button>
        </>
      )}

      <SettingSection title="Companion Digest" onReset={() => resetSection("digest")}>
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          An on-demand overlay card that summarizes your companion relationship at a glance —
          bond level, key stats, dominant mood, growth stage, and a recent journal highlight.
          Trigger it with the <span className="font-mono text-kovy-cyan">Show Companion Digest</span> hotkey
          or the tray menu. Everything is computed locally from your existing engines.
        </p>
        <SwitchSetting
          label="Enable Companion Digest"
          description="Allow the digest overlay card to be summoned"
          checked={digest.enabled}
          onChange={(v) => updateDigest({ enabled: v })}
        />
        {digest.enabled && (
          <>
            <SliderSetting
              label="Auto-dismiss seconds"
              description="How long the digest card stays on screen before fading"
              value={digest.autoDismissSec}
              min={4}
              max={30}
              step={1}
              onChange={(v) => updateDigest({ autoDismissSec: v })}
            />
            <SwitchSetting
              label="Show bond level"
              description="Include bond level, progress bar, and streak"
              checked={digest.showBond}
              onChange={(v) => updateDigest({ showBond: v })}
            />
            <SwitchSetting
              label="Show activity stats"
              description="Include focus minutes, gaming sessions, emotes, and milestones"
              checked={digest.showStats}
              onChange={(v) => updateDigest({ showStats: v })}
            />
            <SwitchSetting
              label="Show dominant mood"
              description="Include the current surface mood"
              checked={digest.showMood}
              onChange={(v) => updateDigest({ showMood: v })}
            />
            <SwitchSetting
              label="Show growth stage"
              description="Include growth stage and age in days"
              checked={digest.showGrowth}
              onChange={(v) => updateDigest({ showGrowth: v })}
            />
            <SwitchSetting
              label="Show recent highlight"
              description="Include a notable recent journal entry"
              checked={digest.showHighlight}
              onChange={(v) => updateDigest({ showHighlight: v })}
            />
          </>
        )}
      </SettingSection>

      <SettingSection title="Companion Chronicle" onReset={() => resetSection("chronicle")}>
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          A longitudinal companion to the Digest. Once per day (at the configured snapshot hour),
          Kovy persists a lightweight snapshot of your companion relationship — bond points, mood,
          focus, and a one-line highlight. Over time these build into trends, streaks, and insights
          you can summon with the <span className="font-mono text-kovy-cyan">Show Companion Chronicle</span> hotkey.
          Snapshots are stored locally only (~150 bytes/day).
        </p>
        <SwitchSetting
          label="Enable Companion Chronicle"
          description="Persist a daily companion snapshot and compute trends"
          checked={chronicle.enabled}
          onChange={(v) => updateChronicle({ enabled: v })}
        />
        {chronicle.enabled && (
          <>
            <SliderSetting
              label="Snapshot hour"
              description="Local hour (0–23) at which the daily snapshot is taken"
              value={chronicle.snapshotHour}
              min={0}
              max={23}
              step={1}
              onChange={(v) => updateChronicle({ snapshotHour: v })}
            />
            <SliderSetting
              label="Retention days"
              description="How many days of snapshot history to keep (30–365)"
              value={chronicle.retentionDays}
              min={30}
              max={365}
              step={1}
              onChange={(v) => updateChronicle({ retentionDays: v })}
            />
            <SliderSetting
              label="Auto-dismiss seconds"
              description="How long the chronicle card stays on screen before fading"
              value={chronicle.autoDismissSec}
              min={4}
              max={30}
              step={1}
              onChange={(v) => updateChronicle({ autoDismissSec: v })}
            />
            <SwitchSetting
              label="Show trend sparkline"
              description="Include the 7-day bond sparkline and weekly delta"
              checked={chronicle.showTrend}
              onChange={(v) => updateChronicle({ showTrend: v })}
            />
            <SwitchSetting
              label="Show insights"
              description="Include generated insight lines (bond growth, focus trend, streak)"
              checked={chronicle.showInsights}
              onChange={(v) => updateChronicle({ showInsights: v })}
            />
            <ChronicleStatus />
          </>
        )}
      </SettingSection>

      <button
        onClick={() => resetSection("stats")}
        className="text-xs text-kovy-text-dim/60 hover:text-kovy-text-dim transition-colors"
      >
        Reset stats to defaults
      </button>
    </div>
  );
}

function ChronicleStatus() {
  const [, forceUpdate] = useState(0);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const snapshots = loadSnapshots();
  const trends = buildTrends(snapshots);
  const summary = summarizeChronicle(trends);

  const handleClear = () => {
    clearSnapshots();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="bg-kovy-surface/40 border border-kovy-border/20 rounded p-2.5 space-y-1.5">
      <div className="text-xs text-kovy-text-dim/70">Chronicle status</div>
      <div className="text-sm text-kovy-text">{summary}</div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-kovy-text-dim/60">
          {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} stored locally
        </span>
        <button
          onClick={handleClear}
          className="text-[10px] text-red-400/80 hover:text-red-400 transition-colors"
        >
          {cleared ? "Cleared" : "Clear history"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-kovy-surface/40 border border-kovy-border/20 rounded p-2.5">
      <div className="text-xs text-kovy-text-dim/70 flex items-center gap-1.5">
        <span>{icon}</span> {label}
      </div>
      <div className="text-lg font-semibold text-kovy-text mt-0.5">{value}</div>
    </div>
  );
}
