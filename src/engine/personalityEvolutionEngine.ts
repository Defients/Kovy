// ============================================================
// Kovy Personality Evolution Engine — slowly shifts personality
// offsets based on interaction patterns, mood history, and time.
// ============================================================

import type { PersonalityEvolutionConfig, PersonalityOffsets, SurfaceMood } from "@/store/types";
import { clamp } from "@/lib/utils";
import { recordError } from "./diagnosticsEngine";

export interface PersonalityEvolutionOutput {
  enabled: boolean;
  offsets: PersonalityOffsets;
  driftDescription: string;
}

const STORAGE_KEY = "kovy-personality-evolution";

const MOOD_INFLUENCE: Record<SurfaceMood, Partial<Record<keyof PersonalityOffsets, number>>> = {
  calm: { wanderBias: -0.001 },
  curious: { curiosityBias: 0.002 },
  playful: { playfulnessBias: 0.002, energyBias: 0.001 },
  focused: { shynessBias: -0.001 },
  sleepy: { energyBias: -0.001 },
  excited: { energyBias: 0.002, playfulnessBias: 0.001 },
  overwhelmed: { shynessBias: 0.002 },
  shy: { shynessBias: 0.001 },
  content: { curiosityBias: -0.001 },
  anxious: { shynessBias: 0.001 },
  nostalgic: { wanderBias: 0.001 },
  determined: { curiosityBias: 0.001, energyBias: 0.001 },
};

export class PersonalityEvolutionEngine {
  private offsets: PersonalityOffsets;
  private moodHistory: SurfaceMood[] = [];
  private readonly HISTORY_MAX = 100;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.offsets = this.load();
  }

  private load(): PersonalityOffsets {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      curiosityBias: 0,
      energyBias: 0,
      shynessBias: 0,
      playfulnessBias: 0,
      wanderBias: 0,
      colorHueOffset: 0,
      sizeOffset: 0,
    };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.offsets));
    } catch { recordError("localStorage save failed", "PersonalityEvolutionEngine"); }
  }

  private saveDebounced(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 1000);
  }

  /** Flush any pending debounced save immediately. Call on shutdown/visibility change. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.save();
    }
  }

  recordMood(mood: SurfaceMood): void {
    this.moodHistory.push(mood);
    if (this.moodHistory.length > this.HISTORY_MAX) {
      this.moodHistory.shift();
    }
  }

  update(dt: number, config: PersonalityEvolutionConfig): PersonalityEvolutionOutput {
    if (!config.enabled) {
      return { enabled: false, offsets: this.offsets, driftDescription: "" };
    }

    // Apply slow drift based on recent mood history
    const recentMoods = this.moodHistory.slice(-20);
    for (const mood of recentMoods) {
      const influence = MOOD_INFLUENCE[mood];
      if (!influence) continue;
      for (const [key, value] of Object.entries(influence)) {
        const k = key as keyof PersonalityOffsets;
        this.offsets[k] = clamp(
          this.offsets[k] + (value as number) * config.evolutionRate * dt * 0.01,
          -0.5, 0.5,
        );
      }
    }

    this.saveDebounced();

    const driftDescription = this.describeDrift();

    return {
      enabled: true,
      offsets: { ...this.offsets },
      driftDescription,
    };
  }

  private describeDrift(): string {
    const o = this.offsets;
    const parts: string[] = [];
    if (o.curiosityBias > 0.1) parts.push("more curious");
    if (o.energyBias > 0.1) parts.push("more energetic");
    if (o.shynessBias > 0.1) parts.push("more shy");
    if (o.playfulnessBias > 0.1) parts.push("more playful");
    if (o.wanderBias > 0.1) parts.push("more adventurous");
    if (parts.length === 0) return "stable personality";
    return `becoming ${parts.join(", ")}`;
  }

  reset(): void {
    this.offsets = {
      curiosityBias: 0, energyBias: 0, shynessBias: 0,
      playfulnessBias: 0, wanderBias: 0,
      colorHueOffset: 0, sizeOffset: 0,
    };
    this.moodHistory = [];
    this.save();
  }
}
