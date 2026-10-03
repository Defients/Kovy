// ============================================================
// Story Engine — weekly narrative chapters (v9.0)
//
// Generates a short narrative chapter each week summarizing Kovy's
// experiences, growth, and relationship with the user. Chapters are
// built from chronicle snapshots and stored locally.
//
// The engine:
// - Checks if it's time to build a new chapter (weekly, on a
//   configurable weekday/hour)
// - Gathers chronicle snapshots from the past week
// - Builds a narrative chapter with sections:
//   - Opening (sets the scene)
//   - Highlights (notable events)
//   - Bond (relationship progress)
//   - Mood (emotional journey)
//   - Closing (looking forward)
// - Optionally polishes with AI (if aiPolish is enabled)
// - Stores the chapter for later viewing
// - Triggers a toast notification when a new chapter is ready
// ============================================================

import type { StoryConfig, SurfaceMood, BondLevel } from "@/store/types";
import type { ChronicleSnapshot } from "./chronicleEngine";
import { loadSnapshots } from "./chronicleStorage";

export interface StoryChapter {
  id: string;
  weekStart: number;       // unix ms
  weekEnd: number;         // unix ms
  title: string;
  sections: StorySection[];
  generatedAt: number;     // unix ms
  aiPolished: boolean;
}

export interface StorySection {
  heading: string;
  body: string;
}

export interface StoryInputs {
  snapshots: ChronicleSnapshot[];
  bondLevel: BondLevel | null;
  totalInteractions: number;
  dominantMood: SurfaceMood;
  streakDays: number;
  kovyName: string;
}

/// Storage key for persisted chapters
const STORY_STORAGE_KEY = "kovy-story-chapters";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startStr} – ${endStr}`;
}

const MOOD_NARRATIVE: Record<SurfaceMood, string> = {
  calm: "a gentle, peaceful week",
  curious: "a week full of wonder and discovery",
  playful: "a lively, playful week",
  focused: "a focused, attentive week",
  sleepy: "a drowsy, restful week",
  excited: "an exciting, energetic week",
  overwhelmed: "a busy, overwhelming week",
  shy: "a quiet, shy week",
  content: "a content, satisfying week",
  anxious: "an anxious, uncertain week",
  nostalgic: "a nostalgic, reflective week",
  determined: "a determined, driven week",
};

const BOND_NARRATIVE: Record<BondLevel, string> = {
  stranger: "We're still getting to know each other.",
  acquaintance: "I'm starting to feel more comfortable around you.",
  companion: "I really enjoy our time together.",
  friend: "You're a true friend — I cherish our bond.",
  best_friend: "You're my best friend. Every moment with you is precious.",
};

function buildTitle(weekStart: Date, kovyName: string, dominantMood: SurfaceMood): string {
  const moodWord = MOOD_NARRATIVE[dominantMood]?.split(" ")[1] ?? "quiet";
  const weekStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${kovyName}'s Week — ${weekStr} (${moodWord})`;
}

function buildSections(inputs: StoryInputs, weekStart: Date, weekEnd: Date): StorySection[] {
  const sections: StorySection[] = [];
  const { snapshots, bondLevel, totalInteractions, dominantMood, streakDays, kovyName } = inputs;

  // Opening
  const weekRange = formatWeekRange(weekStart, weekEnd);
  sections.push({
    heading: "The Week",
    body: `It was ${MOOD_NARRATIVE[dominantMood] ?? "a quiet week"} — ${weekRange}. ${kovyName} spent ${totalInteractions} moments with you, and the streak reached ${streakDays} days.`,
  });

  // Highlights
  const highlights: string[] = [];
  if (snapshots.length > 0) {
    // Find the day with the highest bond points
    const topSnapshot = snapshots.reduce((a, b) =>
      a.bondPoints > b.bondPoints ? a : b
    );
    highlights.push(`Bond was strongest on ${new Date(topSnapshot.timestamp).toLocaleDateString("en-US", { weekday: "long" })}.`);

    // Count milestones
    const totalMilestones = snapshots.reduce((sum, s) => sum + (s.milestoneCount ?? 0), 0);
    if (totalMilestones > 0) {
      highlights.push(`${totalMilestones} milestones were reached this week.`);
    }

    // Count thoughts
    const totalThoughts = snapshots.reduce((sum, s) => sum + (s.thoughts ?? 0), 0);
    if (totalThoughts > 10) {
      highlights.push(`${kovyName} had ${totalThoughts} thoughts — a chatty week.`);
    }
  }
  if (highlights.length === 0) {
    highlights.push("A steady, uneventful week — and that's okay.");
  }
  sections.push({
    heading: "Highlights",
    body: highlights.join(" "),
  });

  // Bond
  if (bondLevel) {
    sections.push({
      heading: "Our Bond",
      body: BOND_NARRATIVE[bondLevel],
    });
  }

  // Mood
  sections.push({
    heading: "Inner Weather",
    body: `The dominant feeling was ${dominantMood}. ${kovyName} drifted through different moods, but ${dominantMood} colored most of the week.`,
  });

  // Closing
  const nextWeek = new Date(weekEnd);
  const nextWeekStr = nextWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  sections.push({
    heading: "Looking Forward",
    body: `A new week begins on ${nextWeekStr}. ${kovyName} is curious what it will bring.`,
  });

  return sections;
}

/// Load persisted chapters from localStorage
export function loadStoryChapters(): StoryChapter[] {
  try {
    const raw = localStorage.getItem(STORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoryChapter[];
  } catch {
    return [];
  }
}

/// Persist chapters to localStorage, respecting retention limit
export function persistStoryChapter(chapter: StoryChapter, retentionWeeks: number): void {
  try {
    const existing = loadStoryChapters();
    existing.push(chapter);
    // Keep only the most recent `retentionWeeks` chapters
    const maxCount = Math.max(1, retentionWeeks);
    const sorted = existing.sort((a, b) => a.weekStart - b.weekStart);
    const trimmed = sorted.slice(-maxCount);
    localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

/// Clear all persisted chapters (for testing or reset)
export function clearStoryChapters(): void {
  try {
    localStorage.removeItem(STORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export interface StoryRunnerOptions {
  config: StoryConfig;
  inputs: StoryInputs;
  now?: Date;
  existingChapters?: StoryChapter[];
}

export class StoryEngine {
  private config: StoryConfig | null = null;
  private lastCheckTime = 0;

  updateConfig(config: StoryConfig): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /// Check if it's time to build a new chapter.
  /// Returns true if a chapter should be built for the current week.
  shouldBuildChapter(now: Date, existingChapters: StoryChapter[]): boolean {
    if (!this.config?.enabled) return false;

    const weekStart = getWeekStart(now);
    const weekStartMs = weekStart.getTime();

    // Check if we already have a chapter for this week
    const hasThisWeek = existingChapters.some(
      (c) => c.weekStart === weekStartMs
    );
    if (hasThisWeek) return false;

    // Check if we've passed the configured weekday/hour
    // weekday: 0=Sunday, which aligns with getWeekStart
    // We build the chapter at the END of the configured weekday (i.e., the
    // following week's start), so we check if we're past the configured
    // weekday + hour for this week.
    const configDay = this.config.weekday;
    const configHour = this.config.hour;

    // Find the target time for this week: the configured weekday at the configured hour
    const targetTime = new Date(weekStart);
    targetTime.setDate(targetTime.getDate() + configDay);
    targetTime.setHours(configHour, 0, 0, 0);

    return now.getTime() >= targetTime.getTime();
  }

  /// Build a story chapter from the given inputs.
  buildChapter(inputs: StoryInputs, now: Date): StoryChapter {
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(weekStart);

    const title = buildTitle(weekStart, inputs.kovyName, inputs.dominantMood);
    const sections = buildSections(inputs, weekStart, weekEnd);

    return {
      id: `story-${weekStart.getTime()}`,
      weekStart: weekStart.getTime(),
      weekEnd: weekEnd.getTime(),
      title,
      sections,
      generatedAt: now.getTime(),
      aiPolished: false,
    };
  }

  /// Polish a chapter's text using AI (placeholder — actual AI integration
  /// would call the OpenRouter transport). For now, this just marks the
  /// chapter as polished.
  async polishChapter(chapter: StoryChapter): Promise<StoryChapter> {
    // In a real implementation, this would call the AI engine to rewrite
    // the sections in a more narrative style. For now, we just mark it.
    return { ...chapter, aiPolished: true };
  }

  /// Main runner — checks if it's time to build, builds, persists, and
  /// returns the new chapter (or null if no chapter was built).
  run(options: StoryRunnerOptions): StoryChapter | null {
    if (!this.config?.enabled) return null;

    const now = options.now ?? new Date();
    const existing = options.existingChapters ?? loadStoryChapters();

    if (!this.shouldBuildChapter(now, existing)) return null;

    const chapter = this.buildChapter(options.inputs, now);

    // Optionally polish with AI
    if (this.config.aiPolish) {
      // Note: AI polishing is async, but run() is sync for simplicity.
      // The caller can call polishChapter() separately if needed.
      // For now, we just mark it as not polished.
    }

    persistStoryChapter(chapter, this.config.retentionWeeks);

    return chapter;
  }

  destroy(): void {
    this.config = null;
    this.lastCheckTime = 0;
  }
}
