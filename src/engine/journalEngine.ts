// ============================================================
// Kovy Journal Engine — automatic diary entries
//
// Generates short journal entries based on Kovy's daily
// experiences: behaviors, moods, interactions, milestones.
// All data local-only, persisted via storage adapter.
// ============================================================

import type { SurfaceMood, BehaviorState, BondLevel } from "@/store/types";
import { recordError } from "./diagnosticsEngine";

export type JournalEntryType =
  | "milestone"
  | "ritual"
  | "bond"
  | "mood_shift"
  | "behavior_first"
  | "daily_summary"
  | "gaming_session"
  | "family_event"
  | "focus_session"
  | "seasonal_event"
  | "growth_event"
  | "celebration"
  | "whisper"
  | "ai_insight"
  | "recall";

export interface JournalEntry {
  id: string;
  type: JournalEntryType;
  timestamp: number; // unix ms
  dateStr: string; // "YYYY-MM-DD"
  title: string;
  body: string;
  mood: SurfaceMood;
  metadata?: Record<string, unknown>;
}

export interface JournalState {
  entries: JournalEntry[];
  lastSummaryDate: string | null;
}

const MAX_ENTRIES = 1000;
const STORAGE_KEY = "kovy-journal";

export function createDefaultJournalState(): JournalState {
  return {
    entries: [],
    lastSummaryDate: null,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateId(): string {
  return `journal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Mood → description mapping ---
const MOOD_DESCRIPTIONS: Record<SurfaceMood, string> = {
  calm: "feeling peaceful and settled",
  curious: "noticing everything with wide eyes",
  playful: "bouncing with extra energy",
  focused: "zeroing in on something interesting",
  sleepy: "drifting and drowsy",
  excited: "practically vibrating with excitement",
  overwhelmed: "a bit too much stimulation",
  shy: "retreating and keeping quiet",
  content: "perfectly happy and satisfied",
  anxious: "on edge and a little worried",
  nostalgic: "remembering fond old memories",
  determined: "ready to tackle any challenge",
};

// --- Entry templates ---
function milestoneEntry(
  milestoneTitle: string,
  milestoneIcon: string,
  mood: SurfaceMood,
): JournalEntry {
  return {
    id: generateId(),
    type: "milestone",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `${milestoneIcon} ${milestoneTitle}`,
    body: `Today I unlocked "${milestoneTitle}". I was ${MOOD_DESCRIPTIONS[mood]} when it happened.`,
    mood,
  };
}

function ritualEntry(
  ritualTitle: string,
  ritualIcon: string,
  mood: SurfaceMood,
  behavior: BehaviorState,
): JournalEntry {
  const behaviorDesc: Record<string, string> = {
    celebrate: "celebrated with a happy dance",
    wander: "wandered around contentedly",
    nap: "settled down for a cozy rest",
    idle_float: "floated peacefully",
    stretch: "did a big stretch",
    yawn: "let out a big yawn",
  };
  const desc = behaviorDesc[behavior] ?? `did a ${behavior} behavior`;
  return {
    id: generateId(),
    type: "ritual",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `${ritualIcon} ${ritualTitle}`,
    body: `Time for ${ritualTitle}. I ${desc}, ${MOOD_DESCRIPTIONS[mood]}.`,
    mood,
  };
}

function bondEntry(
  level: BondLevel,
  totalInteractions: number,
  mood: SurfaceMood,
): JournalEntry {
  return {
    id: generateId(),
    type: "bond",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `🤝 Bond grew to ${level.replace("_", " ")}`,
    body: `Our bond strengthened to ${level.replace("_", " ")} today after ${totalInteractions} interactions. I was ${MOOD_DESCRIPTIONS[mood]}.`,
    mood,
  };
}

function moodShiftEntry(
  fromMood: SurfaceMood,
  toMood: SurfaceMood,
): JournalEntry {
  return {
    id: generateId(),
    type: "mood_shift",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `Mood: ${fromMood} → ${toMood}`,
    body: `I shifted from ${MOOD_DESCRIPTIONS[fromMood]} to ${MOOD_DESCRIPTIONS[toMood]}.`,
    mood: toMood,
  };
}

function dailySummaryEntry(
  entriesToday: JournalEntry[],
  dominantMood: SurfaceMood,
  activeSeconds: number,
): JournalEntry {
  const hours = Math.round((activeSeconds / 3600) * 10) / 10;
  const eventCount = entriesToday.length;
  return {
    id: generateId(),
    type: "daily_summary",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `📖 Daily Summary`,
    body: `Today was a ${dominantMood} day. We spent ${hours}h together with ${eventCount} notable moments.`,
    mood: dominantMood,
    metadata: { eventCount, activeHours: hours },
  };
}

function gamingSessionEntry(
  duration: number,
  peakExcitement: number,
  mood: SurfaceMood,
): JournalEntry {
  const minutes = Math.round(duration / 60);
  return {
    id: generateId(),
    type: "gaming_session",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `🎮 Gaming Session`,
    body: `We gamed together for ${minutes} minutes. Peak excitement was ${Math.round(peakExcitement * 100)}%. I was ${MOOD_DESCRIPTIONS[mood]}.`,
    mood,
    metadata: { durationMinutes: minutes, peakExcitement },
  };
}

function familyEventEntry(
  event: string,
  mood: SurfaceMood,
): JournalEntry {
  return {
    id: generateId(),
    type: "family_event",
    timestamp: Date.now(),
    dateStr: todayStr(),
    title: `👥 Family: ${event}`,
    body: `Family event: ${event}. I was ${MOOD_DESCRIPTIONS[mood]}.`,
    mood,
  };
}

export class JournalEngine {
  private state: JournalState;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initialState?: JournalState) {
    this.state = initialState ?? this.loadFromStorage();
  }

  getState(): JournalState {
    return {
      ...this.state,
      entries: [...this.state.entries],
    };
  }

  getEntries(): JournalEntry[] {
    return [...this.state.entries];
  }

  getEntriesForDay(dateStr: string): JournalEntry[] {
    return this.state.entries.filter(e => e.dateStr === dateStr);
  }

  getRecentEntries(count: number = 20): JournalEntry[] {
    return this.state.entries.slice(-count);
  }

  getEntryCount(): number {
    return this.state.entries.length;
  }

  // --- Recording methods ---

  recordMilestone(title: string, icon: string, mood: SurfaceMood): void {
    this.addEntry(milestoneEntry(title, icon, mood));
  }

  recordRitual(title: string, icon: string, mood: SurfaceMood, behavior: BehaviorState): void {
    this.addEntry(ritualEntry(title, icon, mood, behavior));
  }

  recordBondLevel(level: BondLevel, totalInteractions: number, mood: SurfaceMood): void {
    this.addEntry(bondEntry(level, totalInteractions, mood));
  }

  recordMoodShift(from: SurfaceMood, to: SurfaceMood): void {
    this.addEntry(moodShiftEntry(from, to));
  }

  recordGamingSession(duration: number, peakExcitement: number, mood: SurfaceMood): void {
    this.addEntry(gamingSessionEntry(duration, peakExcitement, mood));
  }

  recordFamilyEvent(event: string, mood: SurfaceMood): void {
    this.addEntry(familyEventEntry(event, mood));
  }

  recordFocusSession(minutes: number, mood: SurfaceMood): void {
    this.addEntry({
      id: generateId(),
      type: "focus_session",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `🎯 Focus Session`,
      body: `We had a ${Math.round(minutes)}-minute focus session together. I was ${MOOD_DESCRIPTIONS[mood]}, helping you stay on track.`,
      mood,
      metadata: { minutes: Math.round(minutes) },
    });
  }

  recordSeasonalEvent(name: string, icon: string, mood: SurfaceMood): void {
    this.addEntry({
      id: generateId(),
      type: "seasonal_event",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `${icon} ${name}`,
      body: `Today is ${name}! The atmosphere feels different. I was ${MOOD_DESCRIPTIONS[mood]}.`,
      mood,
    });
  }

  recordGrowthEvent(stage: string, ageDays: number, mood: SurfaceMood): void {
    this.addEntry({
      id: generateId(),
      type: "growth_event",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `🌱 Grew to ${stage}`,
      body: `I've grown into the ${stage} stage after ${Math.round(ageDays)} days together. I was ${MOOD_DESCRIPTIONS[mood]}.`,
      mood,
      metadata: { stage, ageDays: Math.round(ageDays) },
    });
  }

  recordCelebration(message: string, mood: SurfaceMood): void {
    this.addEntry({
      id: generateId(),
      type: "celebration",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `🎉 Celebration`,
      body: `${message} I was ${MOOD_DESCRIPTIONS[mood]}.`,
      mood,
    });
  }

  recordWhisper(text: string, category: string, mood: SurfaceMood): void {
    this.addEntry({
      id: generateId(),
      type: "whisper",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `💬 Whisper`,
      body: `I whispered "${text}" — a ${category} moment. I was ${MOOD_DESCRIPTIONS[mood]}.`,
      mood,
      metadata: { category },
    });
  }

  recordAiInsight(source: string, thoughtText: string, whisperText: string, mood: SurfaceMood): void {
    const body = whisperText
      ? `AI insight (${source}): Thought "${thoughtText}". Whispered "${whisperText}".`
      : `AI insight (${source}): Thought "${thoughtText}".`;
    this.addEntry({
      id: generateId(),
      type: "ai_insight",
      timestamp: Date.now(),
      dateStr: todayStr(),
      title: `🤖 AI Insight`,
      body,
      mood,
      metadata: { source, thoughtText, whisperText },
    });
  }

  /** Generate end-of-day summary if not already done today */
  maybeGenerateDailySummary(
    activeSeconds: number,
    dominantMood: SurfaceMood,
  ): JournalEntry | null {
    const today = todayStr();
    if (this.state.lastSummaryDate === today) return null;

    const todayEntries = this.getEntriesForDay(today)
      .filter(e => e.type !== "daily_summary");

    const entry = dailySummaryEntry(todayEntries, dominantMood, activeSeconds);
    this.addEntry(entry);
    this.state.lastSummaryDate = today;
    return entry;
  }

  private addEntry(entry: JournalEntry): void {
    this.state.entries.push(entry);
    if (this.state.entries.length > MAX_ENTRIES) {
      this.state.entries = this.state.entries.slice(-MAX_ENTRIES);
    }
    this.saveDebounced();
  }

  /** Export entries as a plain text journal */
  exportAsText(): string {
    const lines: string[] = ["# Kovy Journal", ""];
    let currentDate = "";

    for (const entry of this.state.entries) {
      if (entry.dateStr !== currentDate) {
        currentDate = entry.dateStr;
        lines.push(`## ${currentDate}`, "");
      }
      const time = new Date(entry.timestamp).toLocaleTimeString("en", {
        hour: "2-digit", minute: "2-digit",
      });
      lines.push(`**${time}** — ${entry.title}`);
      lines.push(entry.body);
      lines.push("");
    }

    return lines.join("\n");
  }

  /** Search entries by text, mood, type, or date range (v7.0) */
  search(query: {
    text?: string;
    mood?: SurfaceMood;
    type?: JournalEntry["type"];
    dateFrom?: string;
    dateTo?: string;
  }): JournalEntry[] {
    return this.state.entries.filter(e => {
      if (query.text) {
        const q = query.text.toLowerCase();
        if (!e.title.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q)) return false;
      }
      if (query.mood && e.mood !== query.mood) return false;
      if (query.type && e.type !== query.type) return false;
      if (query.dateFrom && e.dateStr < query.dateFrom) return false;
      if (query.dateTo && e.dateStr > query.dateTo) return false;
      return true;
    });
  }

  /** Export entries as JSON (v7.0) */
  exportJson(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      entryCount: this.state.entries.length,
      entries: this.state.entries,
    }, null, 2);
  }

  /** Generate mood timeline data for visualization (v7.0) */
  getMoodTimeline(): Array<{ timestamp: number; mood: SurfaceMood; type: string }> {
    return this.state.entries
      .filter(e => e.mood)
      .map(e => ({ timestamp: e.timestamp, mood: e.mood!, type: e.type }));
  }

  reset(): void {
    this.state = createDefaultJournalState();
    this.saveToStorage();
  }

  /** Flush any pending debounced save immediately. Call on shutdown/visibility change. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.saveToStorage();
    }
  }

  /** Reload state from localStorage (for settings window to see overlay entries) */
  reload(): void {
    this.state = this.loadFromStorage();
  }

  // --- Persistence ---

  private saveDebounced(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveToStorage();
    }, 500);
  }

  private loadFromStorage(): JournalState {
    try {
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<JournalState>;
        return {
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
          lastSummaryDate: parsed.lastSummaryDate ?? null,
        };
      }
    } catch { /* ignore */ }
    return createDefaultJournalState();
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch { recordError("localStorage save failed", "JournalEngine"); }
  }
}
