// ============================================================
// Kovy Circadian Engine — day/night rhythm, anticipatory behavior,
// dream state intensity, and startle sensitivity.
//
// Maintains a 24-slot activity histogram that adapts over time.
// Computes phase, energy, drowsiness, anticipation, and startle
// thresholds from the histogram and current time-of-day.
//
// This is a bounded local heuristic system. Not ML. Not cloud.
// ============================================================

import type { CircadianConfig, CircadianOutput, CircadianPhase } from "@/store/types";
import { clamp } from "@/lib/utils";

// --- Constants ---

const HOURS = 24;
const DEFAULT_ACTIVITY_CURVE = [
  // 0-5: deep night (very low)
  0.05, 0.03, 0.02, 0.02, 0.03, 0.05,
  // 6-8: dawn (rising)
  0.15, 0.35, 0.55,
  // 9-12: morning (high)
  0.7, 0.8, 0.85, 0.8,
  // 13-15: afternoon (moderate-high)
  0.65, 0.7, 0.75,
  // 16-18: late afternoon (high)
  0.8, 0.85, 0.75,
  // 19-21: evening (declining)
  0.6, 0.5, 0.4,
  // 22-23: night (low)
  0.2, 0.1,
];

// Phase boundaries (hour ranges, inclusive start)
const PHASE_MAP: Array<{ start: number; end: number; phase: CircadianPhase }> = [
  { start: 0, end: 4, phase: "deep_night" },
  { start: 5, end: 6, phase: "dawn" },
  { start: 7, end: 11, phase: "morning" },
  { start: 12, end: 16, phase: "afternoon" },
  { start: 17, end: 18, phase: "dusk" },
  { start: 19, end: 21, phase: "evening" },
  { start: 22, end: 23, phase: "night" },
];

// --- Null output ---

export const NULL_CIRCADIAN_OUTPUT: CircadianOutput = {
  phase: "morning",
  energyMultiplier: 0.6,
  anticipation: 0,
  drowsiness: 0,
  startleSensitivity: 0.3,
  dreamIntensity: 0,
  socialEnergy: 0.5,
};

// --- Phase computation ---

export function getPhaseForHour(hour: number, customSchedule?: { dayStart: number; nightStart: number }): CircadianPhase {
  const h = Math.floor(((hour % 24) + 24) % 24);
  if (customSchedule) {
    const { dayStart, nightStart } = customSchedule;
    if (h >= nightStart || h < dayStart) return "deep_night";
    if (h < dayStart + 2) return "dawn";
    if (h < dayStart + 5) return "morning";
    if (h < nightStart - 3) return "afternoon";
    if (h < nightStart - 1) return "dusk";
    if (h < nightStart) return "evening";
    return "night";
  }
  for (const entry of PHASE_MAP) {
    if (h >= entry.start && h <= entry.end) return entry.phase;
  }
  return "morning"; // fallback
}

// --- Circadian Engine ---

export class CircadianEngine {
  // 24-slot activity histogram (exponential moving average per hour)
  private activityHistogram: number[];

  // Tracking state
  private sampleCount = 0;
  private lastUpdateHour = -1;
  private hourAccum = 0;     // activity accumulated this hour
  private hourSamples = 0;   // samples this hour

  // Startle state
  private lastStartleTime = 0; // monotonic seconds
  private prevTopScore = 0;

  // Engine time
  private time = 0;

  constructor(initialHistogram?: number[]) {
    this.activityHistogram = initialHistogram
      ? [...initialHistogram]
      : [...DEFAULT_ACTIVITY_CURVE];
  }

  /**
   * Main update tick. Call ~1/s from the renderer.
   * Returns the current circadian output for this frame.
   */
  update(
    dt: number,
    config: CircadianConfig,
    motionActivity: number,
    topTargetScore: number,
  ): CircadianOutput {
    if (!config.enabled) {
      return { ...NULL_CIRCADIAN_OUTPUT };
    }

    this.time += dt;
    const now = new Date();
    const hour = now.getHours();
    const minuteFrac = now.getMinutes() / 60;
    const hourFrac = hour + minuteFrac; // continuous hour 0-24

    // --- Histogram adaptation ---
    this.adaptHistogram(hour, motionActivity, config.adaptationRate);

    // --- Phase ---
    const customSchedule = config.customSchedule
      ? { dayStart: config.dayStartTime, nightStart: config.nightStartTime }
      : undefined;
    const phase = getPhaseForHour(hour, customSchedule);

    // --- Energy multiplier from histogram ---
    const rawEnergy = this.interpolateHistogram(hourFrac);
    const amplify = config.amplifyDayNight;
    // Amplify: push energy away from 0.5 (center) toward extremes
    const amplifiedEnergy = 0.5 + (rawEnergy - 0.5) * (1 + amplify);
    const energyMultiplier = clamp(amplifiedEnergy, 0.05, 1);

    // --- Drowsiness: inverse of energy, boosted during low-activity phases ---
    const drowsiness = clamp(1 - energyMultiplier + (phase === "deep_night" ? 0.2 : 0), 0, 1);

    // --- Anticipation: look ahead 1-2 hours, detect rising activity ---
    const anticipation = this.computeAnticipation(hourFrac);

    // --- Startle sensitivity: higher when drowsy or in calm phases ---
    const startleSensitivity = clamp(
      0.2 + drowsiness * 0.5 + (1 - rawEnergy) * 0.3,
      0.1, 1
    );

    // --- Dream intensity: based on drowsiness and nap-worthiness ---
    const dreamIntensity = config.dreamEnabled
      ? clamp(drowsiness * 0.8 + (phase === "deep_night" ? 0.2 : 0), 0, 1)
      : 0;

    // --- Social energy: peaks during high-energy phases, dips at extremes ---
    const socialEnergy = clamp(
      energyMultiplier * 0.7 + anticipation * 0.3,
      0.1, 1
    );

    // Track prev score for startle detection
    this.prevTopScore = topTargetScore;

    return {
      phase,
      energyMultiplier,
      anticipation,
      drowsiness,
      startleSensitivity,
      dreamIntensity,
      socialEnergy,
    };
  }

  /**
   * Detect a startle event: sudden spike in target score.
   * Returns true if a startle should trigger.
   */
  shouldStartle(
    config: CircadianConfig,
    currentTopScore: number,
    circadianOutput: CircadianOutput,
  ): boolean {
    if (!config.startleEnabled) return false;

    // Cooldown check
    if (this.time - this.lastStartleTime < config.startleCooldown) return false;

    // Startle threshold: lower sensitivity = higher threshold needed
    const threshold = 0.6 - circadianOutput.startleSensitivity * 0.3;
    const scoreDelta = currentTopScore - this.prevTopScore;

    if (scoreDelta > threshold && currentTopScore > 0.4) {
      this.lastStartleTime = this.time;
      return true;
    }

    return false;
  }

  /**
   * Get the raw activity histogram (for diagnostics/export).
   */
  getHistogram(): readonly number[] {
    return this.activityHistogram;
  }

  /**
   * Get interpolated energy for a specific fractional hour (0-24).
   */
  getEnergyAtHour(hourFrac: number): number {
    return this.interpolateHistogram(hourFrac);
  }

  /** Full reset */
  reset(): void {
    this.activityHistogram = [...DEFAULT_ACTIVITY_CURVE];
    this.sampleCount = 0;
    this.lastUpdateHour = -1;
    this.hourAccum = 0;
    this.hourSamples = 0;
    this.lastStartleTime = 0;
    this.prevTopScore = 0;
    this.time = 0;
  }

  // --- Internal ---

  private adaptHistogram(hour: number, activity: number, rate: number): void {
    // Accumulate samples for the current hour
    if (hour !== this.lastUpdateHour && this.lastUpdateHour >= 0) {
      // Hour changed — commit accumulated data to previous hour
      if (this.hourSamples > 0) {
        const avgActivity = this.hourAccum / this.hourSamples;
        const h = this.lastUpdateHour;
        // Exponential moving average: blend toward observed activity
        const alpha = rate * 0.1; // slow adaptation
        this.activityHistogram[h] =
          this.activityHistogram[h] * (1 - alpha) + avgActivity * alpha;
        this.activityHistogram[h] = clamp(this.activityHistogram[h], 0.01, 1);
      }
      this.hourAccum = 0;
      this.hourSamples = 0;
    }

    this.lastUpdateHour = hour;
    this.hourAccum += clamp(activity, 0, 1);
    this.hourSamples++;
    this.sampleCount++;
  }

  private interpolateHistogram(hourFrac: number): number {
    const h = ((hourFrac % 24) + 24) % 24;
    const low = Math.floor(h) % 24;
    const high = (low + 1) % 24;
    const t = h - Math.floor(h);
    // Smooth interpolation (cosine) for organic feel
    const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);
    return this.activityHistogram[low] * (1 - smoothT) + this.activityHistogram[high] * smoothT;
  }

  private computeAnticipation(hourFrac: number): number {
    // Look 1 and 2 hours ahead. If activity is rising, anticipation grows.
    const current = this.interpolateHistogram(hourFrac);
    const ahead1 = this.interpolateHistogram(hourFrac + 1);
    const ahead2 = this.interpolateHistogram(hourFrac + 2);

    const rise1 = ahead1 - current;
    const rise2 = ahead2 - current;

    // Anticipation = how much activity is expected to increase
    const rawAnticipation = Math.max(0, rise1 * 0.6 + rise2 * 0.4);
    return clamp(rawAnticipation * 3, 0, 1); // scale up for perceptibility
  }
}
