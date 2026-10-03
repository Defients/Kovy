import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";
import { ConfirmModal } from "../components/ConfirmModal";
import { InfoCard } from "../components/InfoCard";
import { getMemoryStats } from "@/engine/memoryEngine";
import { clearAllMemories, getDbInitError } from "@/lib/memoryDb";
import { exportSoul, importSoul } from "@/lib/soulExport";

export function MemoryTab() {
  const config = useConfigStore((s) => s.draftConfig.memory);
  const habitat = useConfigStore((s) => s.appliedConfig.habitat);
  const update = useConfigStore((s) => s.updateDraftMemory);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [stats, setStats] = useState<{ totalCount: number; entityCount: number; dbAvailable: boolean } | null>(null);
  const [soulStatus, setSoulStatus] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    getMemoryStats().then(setStats);
  }, []);

  const handleExportSoul = async () => {
    try {
      setSoulStatus("Exporting...");
      const json = await exportSoul("kovy-prime", habitat);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kovy-soul-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSoulStatus("Soul exported successfully");
    } catch (e) {
      setSoulStatus(`Export failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    setTimeout(() => setSoulStatus(null), 4000);
  };

  const handleImportSoul = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        setSoulStatus("Importing...");
        const text = await file.text();
        const result = importSoul(text);
        if (result.success && result.entity) {
          setSoulStatus(
            `Imported: ${result.entity.name} — ${result.memorySummaryCount} memory summaries, ${result.appAffinityCount} app affinities`
          );
        } else {
          setSoulStatus(`Import failed: ${result.errors.join(", ")}`);
        }
      } catch (e) {
        setSoulStatus(`Import failed: ${e instanceof Error ? e.message : "unknown error"}`);
      }
      setTimeout(() => setSoulStatus(null), 6000);
    };
    input.click();
  };

  const handleClearMemories = async () => {
    await clearAllMemories();
    const newStats = await getMemoryStats();
    setStats(newStats);
    setSoulStatus("All memories cleared");
    setTimeout(() => setSoulStatus(null), 3000);
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Memory Palace">
        Kovy remembers significant local events over time — app sessions, interactions,
        mood patterns, and quiet periods. All memories are stored locally on your device
        in a bounded SQLite database. No data leaves your computer.
        <p className="text-kovy-text-dim mt-1">
          Memory influence on behavior is subtle: familiar apps feel more comfortable,
          time-of-day patterns gently bias mood, and prolonged interactions build trust.
          Significance scoring is heuristic-based — not ML, not semantic search.
        </p>
      </InfoCard>

      <SettingSection title="Memory" onReset={() => resetSection("memory")}>
        <SwitchSetting
          label="Enable Memory Palace"
          description="Allow Kovy to form and retain local memories from significant events"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        {stats && stats.dbAvailable && (
          <SettingRow label="Stored memories" description="Total memories in the local database">
            <span className="text-xs text-kovy-text font-mono">{stats.entityCount}</span>
          </SettingRow>
        )}
        {stats && !stats.dbAvailable && (
          <SettingRow label="Database status">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-yellow-400">SQLite unavailable</span>
              {getDbInitError() && (
                <span className="text-[10px] text-kovy-text-dim max-w-xs text-right">
                  {getDbInitError()}
                </span>
              )}
              <span className="text-[10px] text-kovy-text-dim">
                Run with `tauri dev` or the built app for SQLite support.
              </span>
            </div>
          </SettingRow>
        )}
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Retention">
            <SliderSetting
              label="Max memories"
              description="Maximum number of memories stored (oldest/least-significant pruned when exceeded)"
              value={config.maxMemories}
              min={500}
              max={5000}
              step={100}
              onChange={(v) => update({ maxMemories: v })}
              displayValue={`${config.maxMemories}`}
            />
            <SliderSetting
              label="Retention period"
              description="Days to keep memories before automatic pruning"
              value={config.retentionDays}
              min={7}
              max={365}
              step={1}
              onChange={(v) => update({ retentionDays: v })}
              displayValue={`${config.retentionDays}d`}
            />
            <SliderSetting
              label="Significance threshold"
              description="Minimum significance score (0–1) for a memory to be stored. Lower = more memories."
              value={config.significanceThreshold}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => update({ significanceThreshold: v })}
            />
            <SwitchSetting
              label="Prune on startup"
              description="Automatically remove expired/over-limit memories when Kovy starts"
              checked={config.pruneOnStartup}
              onChange={(v) => update({ pruneOnStartup: v })}
            />
          </SettingSection>

          <SettingSection title="Privacy">
            <SwitchSetting
              label="Store app names"
              description="Record which application was in the foreground during significant events"
              checked={config.storeAppNames}
              onChange={(v) => update({ storeAppNames: v })}
            />
            <SwitchSetting
              label="Store window titles"
              description="Record truncated window titles (60 chars max, paths/URLs sanitized). Off by default."
              checked={config.storeWindowTitles}
              onChange={(v) => update({ storeWindowTitles: v })}
            />
            {config.storeWindowTitles && (
              <div className="kovy-glass p-3 mx-1 my-2 border-l-2 border-yellow-500/40">
                <p className="text-[10px] text-yellow-400 leading-relaxed">
                  Window titles may contain document names, URLs, or other contextual info.
                  Titles are truncated and sanitized but may still reveal usage patterns.
                  Apps in your Privacy → Sensitive Apps list are never recorded.
                </p>
              </div>
            )}
          </SettingSection>

          <SettingSection title="Kovy Soul">
            <SettingRow
              label="Export Soul"
              description="Save memory summaries, affinities, and personality to a local file. Not encrypted."
            >
              <button onClick={handleExportSoul} className="kovy-btn-outline text-xs">
                Export
              </button>
            </SettingRow>
            <SettingRow
              label="Import Soul"
              description="Load a previously exported Soul file to restore affinities and personality"
            >
              <button onClick={handleImportSoul} className="kovy-btn-outline text-xs">
                Import
              </button>
            </SettingRow>
            <div className="kovy-glass p-3 mx-1 my-2 border-l-2 border-kovy-cyan/40">
              <p className="text-[10px] text-kovy-text-muted leading-relaxed">
                Soul files contain aggregated memory summaries — not raw memory records.
                They are <strong>not encrypted</strong>. Do not share if they contain
                personal data. Soul files include app affinities, schedule patterns,
                and personality offsets.
              </p>
            </div>
            {soulStatus && (
              <div className="px-1 py-2 text-xs text-kovy-cyan font-medium">
                {soulStatus}
              </div>
            )}
          </SettingSection>

          <SettingSection title="Danger Zone">
            <SettingRow label="Clear All Memories" description="Wipe Kovy's memory database completely">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="kovy-btn-outline text-xs text-red-400 border-red-900/50 hover:bg-red-500/10"
              >
                Clear Memories
              </button>
            </SettingRow>
          </SettingSection>

          <ConfirmModal
            isOpen={showClearConfirm}
            title="Clear All Memories"
            message="Are you sure you want to wipe Kovy's memory database? This will permanently erase all learned behaviors and interactions. This cannot be undone."
            confirmText="Clear Memories"
            isDestructive={true}
            onConfirm={handleClearMemories}
            onCancel={() => setShowClearConfirm(false)}
          />
        </>
      )}
    </div>
  );
}
