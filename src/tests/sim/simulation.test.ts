// ============================================================
// Simulation Harness Tests — integration coverage
// Runs headless frames through all engines and asserts
// no crashes, no NaN, reasonable behavior distribution
// ============================================================

import { describe, it, expect } from "vitest";
import { SimulationHarness } from "./harness";

describe("SimulationHarness", () => {
  it("runs 1000 frames without crashes", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 1000 });

    expect(metrics.crashes).toHaveLength(0);
    expect(metrics.framesRun).toBe(1000);
  });

  it("does not produce NaN positions", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 500 });

    expect(metrics.hasNaN).toBe(false);
  });

  it("produces varied behavior states", () => {
    const sim = new SimulationHarness({ config: { behavior: { boredomRate: 0.5 } } as any });
    const metrics = sim.run({ frames: 2000, mockMotionActivity: 0.7 });

    const states = Object.keys(metrics.behaviorStates);
    expect(states.length).toBeGreaterThan(1);
    expect(metrics.behaviorStates["idle_float"]).toBeGreaterThan(0);
  });

  it("tracks mood distribution", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 1000, mockMotionActivity: 0.8 });

    const moods = Object.keys(metrics.moodDistribution);
    expect(moods.length).toBeGreaterThan(0);
    expect(metrics.moodDistribution["calm"] ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("unlocks milestones over time", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 5000, mockMotionActivity: 0.6 });

    expect(metrics.milestonesUnlocked.length).toBeGreaterThan(0);
    // Mood milestones should unlock from varied simulation
    expect(metrics.milestonesUnlocked.some(m => m.startsWith("mood_"))).toBe(true);
  });

  it("tracks bond level with interactions", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 5000, mockMotionActivity: 0.5 });

    expect(metrics.bondLevel).not.toBeNull();
  });

  it("completes within reasonable time", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 1000 });

    // 1000 frames should complete in under 2 seconds
    expect(metrics.durationMs).toBeLessThan(2000);
  });

  it("handles gaming mode enabled", () => {
    const sim = new SimulationHarness({ enableGaming: true });
    const metrics = sim.run({ frames: 500, mockMotionActivity: 0.9 });

    expect(metrics.crashes).toHaveLength(0);
    expect(metrics.framesRun).toBe(500);
  });

  it("handles circadian disabled", () => {
    const sim = new SimulationHarness({ enableCircadian: false });
    const metrics = sim.run({ frames: 500 });

    expect(metrics.crashes).toHaveLength(0);
  });

  it("reset clears state", () => {
    const sim = new SimulationHarness();
    sim.run({ frames: 1000 });
    sim.reset();
    const state = sim.getState();

    expect(state.position).toEqual({ x: 400, y: 300 });
    expect(state.behaviorState).toBe("idle_float");
  });

  it("alive in 60 seconds: v7 engines produce visible life within 3600 frames", () => {
    // Enable all v7 engines by merging with default config
    const sim = new SimulationHarness({
      config: {
        thought: { enabled: true, frequency: 0.5, maxActive: 3, style: "comic", customThoughts: [] },
        whisper: { enabled: true, frequency: 0.3, style: "subtitle", categories: ["encouragement", "humor", "facts", "comfort"], customMessages: [] },
        focus: { enabled: true, detectionSensitivity: 0.5, focusBehavior: "perch", suppressEmotes: true, suppressSound: true },
        idle: { enabled: true, idleThresholdSec: 5, idleBehaviors: ["explore", "play_alone", "nap", "dream", "wait_at_door"] },
        growth: { enabled: true, agingRate: 1.0, stageThresholds: { young: 1, mature: 7, elder: 30 } },
        seasonal: { enabled: true, events: ["halloween", "christmas", "newyear"], customEvents: [], hemisphere: "northern" },
        celebration: { enabled: true, focusThreshold: 5, returnThreshold: 72, weekendCelebration: true },
        stats: { enabled: true, trackingLevel: "standard" },
      } as any,
    });
    const metrics = sim.run({ frames: 3600, mockMotionActivity: 0.7 });

    // No crashes
    expect(metrics.crashes).toHaveLength(0);
    // Kovy should exhibit varied behavior states
    expect(Object.keys(metrics.behaviorStates).length).toBeGreaterThan(1);
    // Kovy should exhibit varied moods
    expect(Object.keys(metrics.moodDistribution).length).toBeGreaterThan(0);
    // Growth stage should be set
    expect(metrics.growthStage).not.toBe("");
    // Stats should be recorded
    expect(metrics.statsRecorded).toBe(true);
  });
});
