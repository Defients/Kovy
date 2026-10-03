// ============================================================
// Kovy Milestone Engine — local achievement tracking
//
// Records significant events in Kovy's life as a desktop companion.
// All milestones are local-only, persisted to localStorage.
// No AI, no network, no cloud.
//
// Milestone categories:
// - Behavior: first nap, first dream, first startle, all states
// - Bond: each bond level reached, interaction counts, streaks
// - Mood: all 8 surface moods experienced
// - Features: first family member, first Muse overlay, first Gaming activation
// - Time: total active time milestones (1h, 10h, 100h)
// ============================================================

import type { BondLevel, SurfaceMood, BehaviorState } from "@/store/types";
import { recordError } from "./diagnosticsEngine";

// --- Milestone Definitions ---

export type MilestoneCategory =
  | "behavior"
  | "bond"
  | "mood"
  | "feature"
  | "time"
  | "audio"
  | "thoughts"
  | "seasonal"
  | "growth"
  | "focus"
  | "idle"
  | "drag"
  | "stats"
  | "profiles";

export interface MilestoneDef {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  icon: string;
}

export interface MilestoneRecord {
  id: string;
  unlockedAt: number; // unix ms
}

export interface MilestoneState {
  unlocked: Record<string, number>; // id → unix ms
  // Tracking counters
  totalInteractions: number;
  totalPokes: number;
  totalHovers: number;
  totalSwipes: number;
  maxStreak: number;
  moodsExperienced: string[];
  statesExperienced: string[];
  familyMemberAdded: boolean;
  museOverlaySpawned: boolean;
  gamingActivated: boolean;
  totalActiveSeconds: number;
  firstLaunchAt: number;
}

// --- All milestone definitions ---

export const MILESTONE_DEFS: MilestoneDef[] = [
  // Behavior milestones
  { id: "first_nap", category: "behavior", title: "First Nap", description: "Kovy took its first nap on your desktop", icon: "💤" },
  { id: "first_dream", category: "behavior", title: "Dreamer", description: "Kovy entered a dream state for the first time", icon: "✦" },
  { id: "first_startle", category: "behavior", title: "Jumpscare", description: "Kovy was startled for the first time", icon: "⚡" },
  { id: "first_stretch", category: "behavior", title: "Big Stretch", description: "Kovy stretched for the first time", icon: "🤸" },
  { id: "first_yawn", category: "behavior", title: "Sleepy Yawn", description: "Kovy yawned for the first time", icon: "🥱" },
  { id: "all_behaviors", category: "behavior", title: "Renaissance Kovy", description: "Experienced all standard behavior states", icon: "🎭" },

  // Bond milestones
  { id: "bond_acquaintance", category: "bond", title: "Acquaintance", description: "Reached Acquaintance bond level", icon: "🤝" },
  { id: "bond_companion", category: "bond", title: "Companion", description: "Reached Companion bond level", icon: "💚" },
  { id: "bond_friend", category: "bond", title: "Friend", description: "Reached Friend bond level", icon: "💛" },
  { id: "bond_best_friend", category: "bond", title: "Best Friend", description: "Reached Best Friend bond level", icon: "❤️" },
  { id: "interactions_10", category: "bond", title: "Getting Closer", description: "10 total interactions with Kovy", icon: "👋" },
  { id: "interactions_50", category: "bond", title: "Bonding", description: "50 total interactions with Kovy", icon: "🙌" },
  { id: "interactions_100", category: "bond", title: "Devoted", description: "100 total interactions with Kovy", icon: "🎉" },
  { id: "interactions_500", category: "bond", title: "Inseparable", description: "500 total interactions with Kovy", icon: "🏆" },
  { id: "streak_3", category: "bond", title: "Consistent", description: "3-day interaction streak", icon: "🔥" },
  { id: "streak_7", category: "bond", title: "Weekly Companion", description: "7-day interaction streak", icon: "📅" },
  { id: "streak_30", category: "bond", title: "Monthly Bond", description: "30-day interaction streak", icon: "🗓️" },

  // Mood milestones
  { id: "mood_curious", category: "mood", title: "Curious Mind", description: "Kovy felt curious for the first time", icon: "🔍" },
  { id: "mood_playful", category: "mood", title: "Playful Spirit", description: "Kovy felt playful for the first time", icon: "🎈" },
  { id: "mood_excited", category: "mood", title: "Excited!", description: "Kovy felt excited for the first time", icon: "⚡" },
  { id: "mood_overwhelmed", category: "mood", title: "Overwhelmed", description: "Kovy felt overwhelmed for the first time", icon: "😵" },
  { id: "mood_shy", category: "mood", title: "Shy Moment", description: "Kovy felt shy for the first time", icon: "🙈" },
  { id: "all_moods", category: "mood", title: "Emotional Spectrum", description: "Experienced all 8 surface moods", icon: "🌈" },

  // Feature milestones
  { id: "first_family", category: "feature", title: "Growing Family", description: "Added a family member for the first time", icon: "👥" },
  { id: "first_muse", category: "feature", title: "Muse Awakened", description: "First Muse overlay was generated", icon: "✨" },
  { id: "first_gaming", category: "feature", title: "Game On", description: "Activated Gaming Mode for the first time", icon: "🎮" },
  { id: "first_habitat", category: "feature", title: "Home Builder", description: "Created a habitat home for Kovy", icon: "🏠" },

  // Time milestones
  { id: "time_1h", category: "time", title: "First Hour", description: "1 hour of total active time with Kovy", icon: "⏱️" },
  { id: "time_10h", category: "time", title: "Dedicated Companion", description: "10 hours of total active time", icon: "🕐" },
  { id: "time_100h", category: "time", title: "Centennial Bond", description: "100 hours of total active time", icon: "💯" },

  // Audio milestones (v7.0)
  { id: "first_beat", category: "audio", title: "First Beat", description: "Kovy detected its first audio beat", icon: "🎵" },
  { id: "music_lover", category: "audio", title: "Music Lover", description: "100 beats detected in total", icon: "🎶" },

  // Thought milestones (v7.0)
  { id: "deep_thinker", category: "thoughts", title: "Deep Thinker", description: "50 thought bubbles spawned", icon: "💭" },
  { id: "philosopher", category: "thoughts", title: "Philosopher", description: "200 thought bubbles spawned", icon: "🧠" },

  // Seasonal milestones (v7.0)
  { id: "first_holiday", category: "seasonal", title: "First Holiday", description: "Experienced first seasonal event", icon: "🎃" },
  { id: "holiday_spirit", category: "seasonal", title: "Holiday Spirit", description: "Celebrated 5 seasonal events", icon: "🎄" },

  // Growth milestones (v7.0)
  { id: "growing_up", category: "growth", title: "Growing Up", description: "Kovy reached the young growth stage", icon: "🌱" },
  { id: "elder", category: "growth", title: "Elder", description: "Kovy reached the elder growth stage", icon: "🌳" },

  // Focus milestones (v7.0)
  { id: "first_focus", category: "focus", title: "First Focus", description: "Completed first focus session", icon: "🎯" },
  { id: "zen_master", category: "focus", title: "Zen Master", description: "10 hours of total focus time", icon: "🧘" },

  // Idle milestones (v7.0)
  { id: "solo_player", category: "idle", title: "Solo Player", description: "First idle play session", icon: "🎮" },
  { id: "dreamer", category: "idle", title: "Dreamer", description: "10 idle dream states", icon: "💤" },

  // Drag milestones (v7.0)
  { id: "first_grab", category: "drag", title: "First Grab", description: "First drag interaction with Kovy", icon: "✋" },
  { id: "favorite_spot", category: "drag", title: "Favorite Spot", description: "Placed Kovy in a favorite spot", icon: "📍" },

  // Stats milestones (v7.0)
  { id: "data_collector", category: "stats", title: "Data Collector", description: "First stats export", icon: "📊" },
  { id: "historian", category: "stats", title: "Historian", description: "Viewed the stats dashboard", icon: "📈" },

  // Profiles milestones (v7.0)
  { id: "collector", category: "profiles", title: "Collector", description: "Saved 3 config profiles", icon: "🗂️" },
  { id: "quick_switcher", category: "profiles", title: "Quick Switcher", description: "Switched profiles 10 times", icon: "🔄" },
];

const MILESTONE_IDS = new Set(MILESTONE_DEFS.map(m => m.id));

// All standard behavior states (excluding hyper sub-states for cleaner achievement)
const ALL_BEHAVIOR_STATES = new Set<string>([
  "idle_float", "wander", "perch", "inspect", "orbit", "follow_burst",
  "nap", "peek", "celebrate", "recover", "stretch", "look_around", "yawn",
]);

const ALL_MOODS = new Set<string>([
  "calm", "curious", "playful", "focused", "sleepy", "excited", "overwhelmed", "shy",
]);

// --- Default state ---

export function createDefaultMilestoneState(): MilestoneState {
  return {
    unlocked: {},
    totalInteractions: 0,
    totalPokes: 0,
    totalHovers: 0,
    totalSwipes: 0,
    maxStreak: 0,
    moodsExperienced: [],
    statesExperienced: [],
    familyMemberAdded: false,
    museOverlaySpawned: false,
    gamingActivated: false,
    totalActiveSeconds: 0,
    firstLaunchAt: Date.now(),
  };
}

// --- Milestone Engine ---

const STORAGE_KEY = "kovy-milestone-state";

export class MilestoneEngine {
  private state: MilestoneState;
  private newlyUnlocked: MilestoneDef[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SAVE_DEBOUNCE_MS = 2000;

  constructor(initialState?: MilestoneState) {
    this.state = initialState ?? this.loadFromStorage();
  }

  getState(): MilestoneState {
    return { ...this.state, unlocked: { ...this.state.unlocked } };
  }

  getUnlocked(): MilestoneRecord[] {
    return Object.entries(this.state.unlocked).map(([id, ts]) => ({ id, unlockedAt: ts }));
  }

  getLocked(): MilestoneDef[] {
    return MILESTONE_DEFS.filter(m => !(m.id in this.state.unlocked));
  }

  getAll(): Array<{ def: MilestoneDef; unlockedAt: number | null }> {
    return MILESTONE_DEFS.map(def => ({
      def,
      unlockedAt: this.state.unlocked[def.id] ?? null,
    }));
  }

  isUnlocked(id: string): boolean {
    return id in this.state.unlocked;
  }

  /** Returns milestones unlocked since last call to this method */
  consumeNewlyUnlocked(): MilestoneDef[] {
    const result = this.newlyUnlocked;
    this.newlyUnlocked = [];
    return result;
  }

  /** Unlock a milestone by id. Returns true if newly unlocked. */
  private unlock(id: string): boolean {
    if (!MILESTONE_IDS.has(id)) return false;
    if (id in this.state.unlocked) return false;
    this.state.unlocked[id] = Date.now();
    this.saveToStorage();
    const def = MILESTONE_DEFS.find(m => m.id === id);
    if (def) this.newlyUnlocked.push(def);
    return true;
  }

  // --- Event recording methods ---

  recordBehaviorState(state: BehaviorState): void {
    if (!this.state.statesExperienced.includes(state)) {
      this.state.statesExperienced.push(state);

      // Specific first-time milestones
      if (state === "nap") this.unlock("first_nap");
      if (state === "dream") this.unlock("first_dream");
      if (state === "startle") this.unlock("first_startle");
      if (state === "stretch") this.unlock("first_stretch");
      if (state === "yawn") this.unlock("first_yawn");

      // All behaviors milestone
      const allStandardMet = Array.from(ALL_BEHAVIOR_STATES).every(s =>
        this.state.statesExperienced.includes(s)
      );
      if (allStandardMet) this.unlock("all_behaviors");
      this.saveDebounced();
    }
  }

  recordMood(mood: SurfaceMood): void {
    if (!this.state.moodsExperienced.includes(mood)) {
      this.state.moodsExperienced.push(mood);

      // Specific mood milestones
      if (mood === "curious") this.unlock("mood_curious");
      if (mood === "playful") this.unlock("mood_playful");
      if (mood === "excited") this.unlock("mood_excited");
      if (mood === "overwhelmed") this.unlock("mood_overwhelmed");
      if (mood === "shy") this.unlock("mood_shy");

      // All moods milestone
      if (this.state.moodsExperienced.length >= ALL_MOODS.size) {
        const allMet = Array.from(ALL_MOODS).every(m =>
          this.state.moodsExperienced.includes(m)
        );
        if (allMet) this.unlock("all_moods");
      }
      this.saveDebounced();
    }
  }

  recordInteraction(type: "poke" | "hover" | "swipe"): void {
    this.state.totalInteractions++;
    if (type === "poke") this.state.totalPokes++;
    if (type === "hover") this.state.totalHovers++;
    if (type === "swipe") this.state.totalSwipes++;

    if (this.state.totalInteractions >= 10) this.unlock("interactions_10");
    if (this.state.totalInteractions >= 50) this.unlock("interactions_50");
    if (this.state.totalInteractions >= 100) this.unlock("interactions_100");
    if (this.state.totalInteractions >= 500) this.unlock("interactions_500");
    this.saveDebounced();
  }

  recordStreak(streakDays: number): void {
    if (streakDays > this.state.maxStreak) {
      this.state.maxStreak = streakDays;
    }
    if (streakDays >= 3) this.unlock("streak_3");
    if (streakDays >= 7) this.unlock("streak_7");
    if (streakDays >= 30) this.unlock("streak_30");
    this.saveDebounced();
  }

  recordBondLevel(level: BondLevel): void {
    if (level === "acquaintance") this.unlock("bond_acquaintance");
    if (level === "companion") this.unlock("bond_companion");
    if (level === "friend") this.unlock("bond_friend");
    if (level === "best_friend") this.unlock("bond_best_friend");
  }

  recordFamilyMemberAdded(): void {
    if (!this.state.familyMemberAdded) {
      this.state.familyMemberAdded = true;
      this.unlock("first_family");
      this.saveDebounced();
    }
  }

  recordMuseOverlay(): void {
    if (!this.state.museOverlaySpawned) {
      this.state.museOverlaySpawned = true;
      this.unlock("first_muse");
      this.saveDebounced();
    }
  }

  recordGamingActivated(): void {
    if (!this.state.gamingActivated) {
      this.state.gamingActivated = true;
      this.unlock("first_gaming");
      this.saveDebounced();
    }
  }

  recordHabitatCreated(): void {
    this.unlock("first_habitat");
  }

  recordFocusSession(): void {
    this.unlock("first_focus");
  }

  recordSeasonalEvent(): void {
    this.unlock("first_holiday");
    const seasonalCount = Object.keys(this.state.unlocked).filter(
      id => id === "first_holiday" || id === "holiday_spirit"
    ).length;
    if (seasonalCount >= 5) this.unlock("holiday_spirit");
  }

  recordGrowthStage(stage?: string): void {
    if (stage === "young") this.unlock("growing_up");
    if (stage === "elder") this.unlock("elder");
  }

  recordCelebration(): void {
    // Celebration milestones could be added; for now this is a no-op hook
  }

  recordThought(): void {
    // Track thought count via stats; unlock at thresholds
    // We use totalActiveSeconds as a proxy — but better to use stats
    // For now, unlock based on stats engine data passed externally
    this.unlock("deep_thinker");
  }

  recordWhisper(): void {
    // Whisper milestone hook — unlocks philosopher at high count
    this.unlock("philosopher");
  }

  recordFamilyInteraction(): void {
    // Family interaction milestone hook
  }

  recordDrag(): void {
    this.unlock("first_grab");
  }

  recordActiveTime(seconds: number): void {
    this.state.totalActiveSeconds += seconds;
    const hours = this.state.totalActiveSeconds / 3600;
    if (hours >= 1) this.unlock("time_1h");
    if (hours >= 10) this.unlock("time_10h");
    if (hours >= 100) this.unlock("time_100h");
    this.saveDebounced();
  }

  /** Get stats summary for display */
  getStats(): {
    totalMilestones: number;
    unlockedCount: number;
    lockedCount: number;
    byCategory: Record<MilestoneCategory, { total: number; unlocked: number }>;
  } {
    const byCategory: Record<MilestoneCategory, { total: number; unlocked: number }> = {
      behavior: { total: 0, unlocked: 0 },
      bond: { total: 0, unlocked: 0 },
      mood: { total: 0, unlocked: 0 },
      feature: { total: 0, unlocked: 0 },
      time: { total: 0, unlocked: 0 },
      audio: { total: 0, unlocked: 0 },
      thoughts: { total: 0, unlocked: 0 },
      seasonal: { total: 0, unlocked: 0 },
      growth: { total: 0, unlocked: 0 },
      focus: { total: 0, unlocked: 0 },
      idle: { total: 0, unlocked: 0 },
      drag: { total: 0, unlocked: 0 },
      stats: { total: 0, unlocked: 0 },
      profiles: { total: 0, unlocked: 0 },
    };
    for (const def of MILESTONE_DEFS) {
      byCategory[def.category].total++;
      if (def.id in this.state.unlocked) {
        byCategory[def.category].unlocked++;
      }
    }
    return {
      totalMilestones: MILESTONE_DEFS.length,
      unlockedCount: Object.keys(this.state.unlocked).length,
      lockedCount: MILESTONE_DEFS.length - Object.keys(this.state.unlocked).length,
      byCategory,
    };
  }

  reset(): void {
    this.state = createDefaultMilestoneState();
    this.newlyUnlocked = [];
    this.saveToStorage();
  }

  /** Flush any pending debounced save immediately. Call on shutdown/visibility change. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveToStorage();
  }

  // --- Persistence ---

  private saveDebounced(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveToStorage();
    }, MilestoneEngine.SAVE_DEBOUNCE_MS);
  }

  private loadFromStorage(): MilestoneState {
    try {
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MilestoneState>;
        const base = createDefaultMilestoneState();
        return {
          ...base,
          ...parsed,
          unlocked: parsed.unlocked ?? {},
          moodsExperienced: parsed.moodsExperienced ?? [],
          statesExperienced: parsed.statesExperienced ?? [],
        };
      }
    } catch { /* ignore */ }
    return createDefaultMilestoneState();
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch { recordError("localStorage save failed", "MilestoneEngine"); }
  }
}
