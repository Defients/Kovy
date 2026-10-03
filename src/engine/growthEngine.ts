// ============================================================
// Kovy Growth Engine — tracks entity aging through stages
// from sprout to elder. Persists age in localStorage.
// ============================================================

import type { GrowthConfig, GrowthStage } from "@/store/types";
import { clamp } from "@/lib/utils";
import { recordError } from "./diagnosticsEngine";

export interface GrowthOutput {
  enabled: boolean;
  stage: GrowthStage;
  ageDays: number;
  progressToNext: number; // 0-1
  sizeMultiplier: number; // visual size modifier based on stage
}

export const NULL_GROWTH_OUTPUT: GrowthOutput = {
  enabled: false,
  stage: "sprout",
  ageDays: 0,
  progressToNext: 0,
  sizeMultiplier: 1.0,
};

const STAGE_SIZES: Record<GrowthStage, number> = {
  sprout: 0.75,
  young: 0.9,
  mature: 1.0,
  elder: 1.05,
};

const STORAGE_KEY = "kovy-growth-state";

interface PersistedGrowth {
  firstLaunchTime: number;
  lastUpdate: number;
}

export class GrowthEngine {
  private firstLaunchTime: number;
  private lastUpdate: number;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const stored = this.load();
    this.firstLaunchTime = stored.firstLaunchTime;
    this.lastUpdate = stored.lastUpdate;
  }

  private load(): PersistedGrowth {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedGrowth;
        if (parsed.firstLaunchTime && parsed.lastUpdate) return parsed;
      }
    } catch { /* ignore */ }
    const now = Date.now();
    const state = { firstLaunchTime: now, lastUpdate: now };
    this.save(state);
    return state;
  }

  private save(state: PersistedGrowth): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { recordError("localStorage save failed", "GrowthEngine"); }
  }

  private saveDebounced(state: PersistedGrowth): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save(state);
    }, 2000);
  }

  /** Flush any pending debounced save immediately. Call on shutdown/visibility change. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.save({ firstLaunchTime: this.firstLaunchTime, lastUpdate: this.lastUpdate });
    }
  }

  update(dt: number, config: GrowthConfig): GrowthOutput {
    if (!config.enabled) return NULL_GROWTH_OUTPUT;

    const now = Date.now();
    const elapsedSec = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    this.saveDebounced({ firstLaunchTime: this.firstLaunchTime, lastUpdate: now });

    const ageDays = ((now - this.firstLaunchTime) / (1000 * 60 * 60 * 24)) * config.agingRate;
    const thresholds = config.stageThresholds;

    let stage: GrowthStage = "sprout";
    let progressToNext = 0;

    if (ageDays >= thresholds.elder) {
      stage = "elder";
      progressToNext = 1.0;
    } else if (ageDays >= thresholds.mature) {
      stage = "mature";
      progressToNext = clamp((ageDays - thresholds.mature) / (thresholds.elder - thresholds.mature), 0, 1);
    } else if (ageDays >= thresholds.young) {
      stage = "young";
      progressToNext = clamp((ageDays - thresholds.young) / (thresholds.mature - thresholds.young), 0, 1);
    } else {
      stage = "sprout";
      progressToNext = clamp(ageDays / thresholds.young, 0, 1);
    }

    return {
      enabled: true,
      stage,
      ageDays,
      progressToNext,
      sizeMultiplier: STAGE_SIZES[stage],
    };
  }

  reset(): void {
    const now = Date.now();
    this.firstLaunchTime = now;
    this.lastUpdate = now;
    this.save({ firstLaunchTime: now, lastUpdate: now });
  }
}
