import { useState, useEffect, useMemo } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { EmptyState } from "../components/EmptyState";
import { ConfirmModal } from "../components/ConfirmModal";
import { JournalEngine } from "@/engine/journalEngine";
import { getMoodColor } from "@/engine/moodEngine";

const TYPE_ICONS: Record<string, string> = {
  milestone: "🏆",
  ritual: "📅",
  bond: "🤝",
  mood_shift: "😊",
  gaming_session: "🎮",
  family_event: "👥",
  daily_summary: "📋",
  focus_session: "🎯",
  growth_event: "🌱",
  celebration: "🎉",
  whisper: "💬",
  seasonal_event: "☁",
  behavior_first: "✨",
  ai_insight: "🤖",
  recall: "🕰️",
};

const TYPE_LABELS: Record<string, string> = {
  milestone: "Milestone",
  ritual: "Ritual",
  bond: "Bond",
  mood_shift: "Mood Shift",
  gaming_session: "Gaming Session",
  family_event: "Family Event",
  daily_summary: "Daily Summary",
  focus_session: "Focus Session",
  growth_event: "Growth",
  celebration: "Celebration",
  whisper: "Whisper",
  seasonal_event: "Seasonal",
  behavior_first: "First Behavior",
  ai_insight: "AI Insight",
  recall: "Recall",
};

function formatDateGroup(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  // For older entries, fall back to the time
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function JournalTab() {
  const config = useConfigStore((s) => s.draftConfig.journal);
  const update = useConfigStore((s) => s.updateDraftJournal);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [engine] = useState(() => new JournalEngine());
  const [journalTick, forceUpdate] = useState(0);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      engine.reload();
      forceUpdate((n) => n + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [engine]);

  const entries = useMemo(() => engine.getEntries(), [engine, journalTick]);
  const filtered = useMemo(() => {
    let result = entries;
    if (filterType !== "all") {
      result = result.filter((e) => e.type === filterType);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.body?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [entries, filterType, searchText]);

  const handleExport = () => {
    const text = engine.exportAsText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kovy-journal-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    engine.reset();
    forceUpdate((n) => n + 1);
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Journal" accent="violet">
        Kovy keeps a private journal of significant moments — milestones reached,
        rituals performed, bond levels changed, mood shifts, gaming sessions, and
        family events. All entries are stored locally. No AI, no cloud.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("journal")}>
        <SwitchSetting
          label="Journal enabled"
          description="Record Kovy's experiences automatically"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <SwitchSetting
          label="Daily summary"
          description="Auto-generate an end-of-day summary entry"
          checked={config.generateDailySummary}
          onChange={(v) => update({ generateDailySummary: v })}
        />
        <SliderSetting
          label="Max entries"
          description="Maximum number of journal entries to keep (older entries are pruned)"
          value={config.maxEntries}
          min={100} max={2000} step={100}
          onChange={(v) => update({ maxEntries: Math.round(v) })}
          displayValue={`${config.maxEntries}`}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Entries">
            <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="kovy-input text-xs py-1 flex-1 min-w-[120px]"
              >
                <option value="all">All types ({entries.length})</option>
                {Object.entries(TYPE_LABELS).map(([type, label]) => {
                  const count = entries.filter((e) => e.type === type).length;
                  return (
                    <option key={type} value={type}>{label} ({count})</option>
                  );
                })}
              </select>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search entries..."
                className="kovy-input text-xs py-1 flex-1 min-w-[100px]"
              />
              <button
                onClick={handleExport}
                className="kovy-btn-secondary text-xs px-3 py-1.5"
              >
                Export
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="kovy-btn-danger text-xs px-3 py-1.5"
              >
                Clear
              </button>
            </div>
          </SettingSection>

          <SettingSection title="Journal Log">
            <div className="px-3 py-2 max-h-[28rem] overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <EmptyState
                  icon="📖"
                  title="No entries yet"
                  description="Kovy's experiences will appear here as they happen."
                />
              ) : (() => {
                const reversed = filtered.slice().reverse();
                const groups: Record<string, typeof reversed> = {};
                for (const entry of reversed) {
                  if (!groups[entry.dateStr]) groups[entry.dateStr] = [];
                  groups[entry.dateStr].push(entry);
                }
                return Object.entries(groups).map(([dateStr, entries]) => (
                  <div key={dateStr}>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-kovy-text-dim/60 px-1 pt-2 pb-1 sticky top-0 bg-kovy-surface/80 backdrop-blur-sm">
                      {formatDateGroup(dateStr)}
                    </div>
                    <div className="space-y-1.5">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 px-2 py-1.5 rounded-lg bg-kovy-surface-light/30 hover:bg-kovy-surface-light/50 transition-colors"
                        >
                          <span className="text-sm flex-shrink-0 mt-0.5">
                            {TYPE_ICONS[entry.type] ?? "📝"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-kovy-text">
                              {entry.title}
                            </div>
                            <div className="text-[10px] text-kovy-text-dim">
                              {TYPE_LABELS[entry.type] ?? entry.type} ·{" "}
                              {formatRelativeTime(entry.timestamp)}
                            </div>
                            {entry.body && (
                              <div className="text-[10px] text-kovy-text-dim/80 mt-0.5 leading-relaxed">
                                {entry.body}
                              </div>
                            )}
                          </div>
                          {entry.mood && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                              style={{ backgroundColor: getMoodColor(entry.mood, 0.5) }}
                              title={`Mood: ${entry.mood}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </SettingSection>
        </>
      )}

      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Journal"
        message="Delete all journal entries? This cannot be undone."
        confirmText="Clear All"
        isDestructive
        onConfirm={() => {
          handleClear();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
