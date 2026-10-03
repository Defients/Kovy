// ============================================================
// Kovy Bond Engine — relationship progression system
//
// Tracks the user-Kovy relationship over time using local state.
// Bond points accumulate through interactions (pokes, hovers, swipes)
// and decay slowly without contact. Five bond levels unlock subtle
// behavioral changes: warmer colors, closer following, more emotes.
//
// All state is persisted to localStorage. No AI, no network, no cloud.
// ============================================================

import type { BondConfig, BondState, BondLevel } from "@/store/types";
import { clamp } from "@/lib/utils";
import { recordError } from "./diagnosticsEngine";

// --- Bond level thresholds ---

const BOND_THRESHOLDS: Array<{ level: BondLevel; min: number }> = [
  { level: "stranger", min: 0 },
  { level: "acquaintance", min: 50 },
  { level: "companion", min: 150 },
  { level: "friend", min: 350 },
  { level: "best_friend", min: 600 },
];

const MAX_BOND_POINTS = 1000;

// --- Interaction point values ---

const POINTS_PER_POKE = 3;
const POINTS_PER_HOVER = 1;
const POINTS_PER_SWIPE = 2;
const DAILY_BONUS = 5;       // first interaction of the day
const STREAK_BONUS_PER_DAY = 0.5;  // additional per streak day, capped

// --- Helpers ---

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00").getTime();
  const b = new Date(dateB + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function getBondLevel(points: number): BondLevel {
  let level: BondLevel = "stranger";
  for (const entry of BOND_THRESHOLDS) {
    if (points >= entry.min) level = entry.level;
  }
  return level;
}

export function getBondProgress(points: number): { current: number; next: number | null; progress: number } {
  const level = getBondLevel(points);
  const idx = BOND_THRESHOLDS.findIndex(e => e.level === level);
  const current = points;
  const next = idx < BOND_THRESHOLDS.length - 1 ? BOND_THRESHOLDS[idx + 1].min : null;
  const prevMin = BOND_THRESHOLDS[idx].min;
  const progress = next !== null
    ? clamp((current - prevMin) / (next - prevMin), 0, 1)
    : 1;
  return { current, next, progress };
}

// --- Bond level modifiers ---

export function getBondMoodModifier(level: BondLevel): { trustBoost: number; comfortBoost: number; emoteBoost: number } {
  switch (level) {
    case "stranger":      return { trustBoost: 0,    comfortBoost: 0,    emoteBoost: 0 };
    case "acquaintance":  return { trustBoost: 0.05, comfortBoost: 0.03, emoteBoost: 0.1 };
    case "companion":     return { trustBoost: 0.10, comfortBoost: 0.08, emoteBoost: 0.2 };
    case "friend":        return { trustBoost: 0.18, comfortBoost: 0.15, emoteBoost: 0.35 };
    case "best_friend":   return { trustBoost: 0.25, comfortBoost: 0.22, emoteBoost: 0.5 };
  }
}

// --- Default state ---

export function createDefaultBondState(): BondState {
  const today = todayISO();
  return {
    bondPoints: 0,
    bondLevel: "stranger",
    daysTogether: 1,
    totalPokes: 0,
    totalHovers: 0,
    totalSwipes: 0,
    lastInteractionDate: today,
    streakDays: 1,
    firstLaunchDate: today,
  };
}

// --- Bond Engine ---

const STORAGE_KEY = "kovy-bond-state";

export class BondEngine {
  private state: BondState;
  private config: BondConfig;
  private lastDayCheck: string = "";
  private previousLevel: BondLevel;
  private pendingMilestoneVfx: string | null = null;

  constructor(config: BondConfig, initialState?: BondState) {
    this.config = config;
    this.state = initialState ?? this.loadFromStorage();
    this.previousLevel = this.state.bondLevel;
    this.checkDayRollover();
  }

  updateConfig(config: BondConfig): void {
    this.config = config;
  }

  getState(): BondState {
    return { ...this.state };
  }

  /** Called when a poke interaction is detected */
  recordPoke(): BondState {
    if (!this.config.enabled) return this.getState();
    this.checkDayRollover();
    const bonus = this.computeDailyBonus();
    this.state.bondPoints = clamp(this.state.bondPoints + POINTS_PER_POKE + bonus, 0, MAX_BOND_POINTS);
    this.state.totalPokes++;
    this.state.bondLevel = getBondLevel(this.state.bondPoints);
    this.checkLevelMilestone();
    this.saveToStorage();
    return this.getState();
  }

  /** Called when a hover (cursor lingering near Kovy) is detected */
  recordHover(): BondState {
    if (!this.config.enabled) return this.getState();
    this.checkDayRollover();
    const bonus = this.computeDailyBonus();
    this.state.bondPoints = clamp(this.state.bondPoints + POINTS_PER_HOVER + bonus, 0, MAX_BOND_POINTS);
    this.state.totalHovers++;
    this.state.bondLevel = getBondLevel(this.state.bondPoints);
    this.checkLevelMilestone();
    this.saveToStorage();
    return this.getState();
  }

  /** Called when a swipe (fast cursor pass near Kovy) is detected */
  recordSwipe(): BondState {
    if (!this.config.enabled) return this.getState();
    this.checkDayRollover();
    const bonus = this.computeDailyBonus();
    this.state.bondPoints = clamp(this.state.bondPoints + POINTS_PER_SWIPE + bonus, 0, MAX_BOND_POINTS);
    this.state.totalSwipes++;
    this.state.bondLevel = getBondLevel(this.state.bondPoints);
    this.checkLevelMilestone();
    this.saveToStorage();
    return this.getState();
  }

  /** Compute daily bonus for first interaction of the day + streak */
  private computeDailyBonus(): number {
    const today = todayISO();
    if (this.state.lastInteractionDate === today) return 0;

    // First interaction today — check streak
    const gap = daysBetween(this.state.lastInteractionDate, today);
    if (gap === 1) {
      // Consecutive day — streak continues
      this.state.streakDays = Math.min(this.state.streakDays + 1, 365);
    } else if (gap > 1) {
      // Streak broken
      this.state.streakDays = 1;
    }
    this.state.lastInteractionDate = today;
    const streakBonus = Math.min(this.state.streakDays * STREAK_BONUS_PER_DAY, 10);
    return DAILY_BONUS + streakBonus;
  }

  /** Check if a new day has started and apply decay + update daysTogether */
  private checkDayRollover(): void {
    const today = todayISO();
    if (this.lastDayCheck === today) return;
    this.lastDayCheck = today;

    // Update daysTogether
    this.state.daysTogether = Math.max(1, daysBetween(this.state.firstLaunchDate, today) + 1);

    // Apply bond decay if no interaction today
    if (this.state.lastInteractionDate !== today) {
      const gap = daysBetween(this.state.lastInteractionDate, today);
      if (gap > 0) {
        const decay = this.config.bondDecayPerDay * gap * 10;  // scale to meaningful points
        this.state.bondPoints = clamp(this.state.bondPoints - decay, 0, MAX_BOND_POINTS);
        this.state.bondLevel = getBondLevel(this.state.bondPoints);
      }
      // Streak breaks if gap > 1
      if (gap > 1) {
        this.state.streakDays = 0;
      }
    }

    this.saveToStorage();
  }

  /** Periodic tick — call ~1/s to check day rollover */
  tick(): void {
    this.checkDayRollover();
  }

  /** Check if bond level just increased and trigger milestone VFX (v7.0) */
  private checkLevelMilestone(): void {
    if (!this.config.bondMilestoneVfx) return;
    if (this.state.bondLevel !== this.previousLevel) {
      const levelOrder: BondLevel[] = ["stranger", "acquaintance", "companion", "friend", "best_friend"];
      const prevIdx = levelOrder.indexOf(this.previousLevel);
      const newIdx = levelOrder.indexOf(this.state.bondLevel);
      if (newIdx > prevIdx) {
        const milestones = ["heart_burst", "rainbow_trail", "golden_aura", "star_constellation"];
        this.pendingMilestoneVfx = milestones[Math.min(newIdx - 1, milestones.length - 1)] ?? "heart_burst";
      }
      this.previousLevel = this.state.bondLevel;
    }
  }

  /** Consume pending milestone VFX event (v7.0) */
  consumeMilestoneVfx(): string | null {
    const vfx = this.pendingMilestoneVfx;
    this.pendingMilestoneVfx = null;
    return vfx;
  }

  reset(): void {
    this.state = createDefaultBondState();
    this.lastDayCheck = todayISO();
    this.saveToStorage();
  }

  // --- Persistence ---

  private loadFromStorage(): BondState {
    try {
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BondState>;
        const base = createDefaultBondState();
        return {
          ...base,
          ...parsed,
          bondLevel: getBondLevel(parsed.bondPoints ?? 0),
        };
      }
    } catch { /* ignore */ }
    return createDefaultBondState();
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch { recordError("localStorage save failed", "BondEngine"); }
  }
}
