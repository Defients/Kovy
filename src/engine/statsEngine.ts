// ============================================================
// Kovy Stats Engine — tracks usage statistics like total
// interactions, time together, focus minutes, etc.
// Persists to localStorage. Privacy-first: all local.
// ============================================================

import type { StatsConfig, TrackingLevel } from "@/store/types";
import { recordError } from "./diagnosticsEngine";

export interface StatsData {
  totalPokes: number;
  totalHovers: number;
  totalSwipes: number;
  totalFocusMinutes: number;
  totalIdleMinutes: number;
  totalGamingSessions: number;
  totalEmotes: number;
  totalThoughts: number;
  totalWhispers: number;
  totalDragReleases: number;
  totalProfileSwitches: number;
  totalRituals: number;
  totalFamilyInteractions: number;
  totalWeatherChanges: number;
  totalSeasonalEvents: number;
  totalGrowthEvents: number;
  longestFocusSession: number; // minutes
  daysActive: number;
  lastActiveDate: string;
}

export interface StatsOutput {
  enabled: boolean;
  trackingLevel: TrackingLevel;
  stats: StatsData;
}

export const NULL_STATS_OUTPUT: StatsOutput = {
  enabled: false,
  trackingLevel: "standard",
  stats: {
    totalPokes: 0, totalHovers: 0, totalSwipes: 0,
    totalFocusMinutes: 0, totalIdleMinutes: 0,
    totalGamingSessions: 0, totalEmotes: 0,
    totalThoughts: 0, totalWhispers: 0,
    totalDragReleases: 0, totalProfileSwitches: 0,
    totalRituals: 0, totalFamilyInteractions: 0,
    totalWeatherChanges: 0, totalSeasonalEvents: 0,
    totalGrowthEvents: 0,
    longestFocusSession: 0, daysActive: 1,
    lastActiveDate: new Date().toISOString().slice(0, 10),
  },
};

const STORAGE_KEY = "kovy-stats";

function createDefaultStats(): StatsData {
  return {
    totalPokes: 0, totalHovers: 0, totalSwipes: 0,
    totalFocusMinutes: 0, totalIdleMinutes: 0,
    totalGamingSessions: 0, totalEmotes: 0,
    totalThoughts: 0, totalWhispers: 0,
    totalDragReleases: 0, totalProfileSwitches: 0,
    totalRituals: 0, totalFamilyInteractions: 0,
    totalWeatherChanges: 0, totalSeasonalEvents: 0,
    totalGrowthEvents: 0,
    longestFocusSession: 0, daysActive: 1,
    lastActiveDate: new Date().toISOString().slice(0, 10),
  };
}

export class StatsEngine {
  private stats: StatsData;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.stats = this.load();
  }

  private load(): StatsData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...createDefaultStats(), ...parsed };
      }
    } catch { /* ignore */ }
    return createDefaultStats();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch { recordError("localStorage save failed", "StatsEngine"); }
  }

  private saveDebounced(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 500);
  }

  update(config: StatsConfig): StatsOutput {
    if (!config.enabled) return { ...NULL_STATS_OUTPUT, trackingLevel: config.trackingLevel };

    // Update daysActive
    const today = new Date().toISOString().slice(0, 10);
    if (this.stats.lastActiveDate !== today) {
      this.stats.daysActive++;
      this.stats.lastActiveDate = today;
      this.save();
    }

    return {
      enabled: true,
      trackingLevel: config.trackingLevel,
      stats: { ...this.stats },
    };
  }

  recordPoke(): void { this.stats.totalPokes++; this.saveDebounced(); }
  recordHover(): void { this.stats.totalHovers++; this.saveDebounced(); }
  recordSwipe(): void { this.stats.totalSwipes++; this.saveDebounced(); }
  recordFocusMinutes(min: number): void {
    this.stats.totalFocusMinutes += min;
    if (min > this.stats.longestFocusSession) this.stats.longestFocusSession = min;
    this.saveDebounced();
  }
  recordIdleMinutes(min: number): void { this.stats.totalIdleMinutes += min; this.saveDebounced(); }
  recordGamingSession(): void { this.stats.totalGamingSessions++; this.saveDebounced(); }
  recordEmote(): void { this.stats.totalEmotes++; this.saveDebounced(); }
  recordThought(): void { this.stats.totalThoughts++; this.saveDebounced(); }
  recordWhisper(): void { this.stats.totalWhispers++; this.saveDebounced(); }
  recordDragRelease(): void { this.stats.totalDragReleases++; this.saveDebounced(); }
  recordProfileSwitch(): void { this.stats.totalProfileSwitches++; this.saveDebounced(); }
  recordRitual(): void { this.stats.totalRituals++; this.saveDebounced(); }
  recordFamilyInteraction(): void { this.stats.totalFamilyInteractions++; this.saveDebounced(); }
  recordWeatherChange(): void { this.stats.totalWeatherChanges++; this.saveDebounced(); }
  recordSeasonalEvent(): void { this.stats.totalSeasonalEvents++; this.saveDebounced(); }
  recordGrowthEvent(): void { this.stats.totalGrowthEvents++; this.saveDebounced(); }

  reset(): void {
    this.stats = createDefaultStats();
    this.save();
  }

  /** Force immediate save of any pending debounced data */
  flushSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
  }
}
