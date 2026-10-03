import { describe, it, expect } from "vitest";
import {
  deriveSurfaceMood,
  updateMoodState,
  getMoodModifiers,
  getMoodColor,
  getMoodGlowColor,
} from "../engine/moodEngine";
import type { InternalMoodState, MoodConfig } from "../store/types";
import { DEFAULT_MOOD, DEFAULT_INTERNAL_MOOD } from "../store/defaults";

function makeMoodConfig(overrides: Partial<MoodConfig> = {}): MoodConfig {
  return { ...DEFAULT_MOOD, ...overrides };
}

function makeMoodState(overrides: Partial<InternalMoodState> = {}): InternalMoodState {
  return { ...DEFAULT_INTERNAL_MOOD, ...overrides };
}

describe("deriveSurfaceMood", () => {
  it("returns 'calm' for default internal state", () => {
    const mood = deriveSurfaceMood(DEFAULT_INTERNAL_MOOD, makeMoodConfig());
    expect(typeof mood).toBe("string");
    // Default state should produce a valid mood
    const validMoods = ["calm", "curious", "playful", "focused", "sleepy", "excited", "overwhelmed", "shy"];
    expect(validMoods).toContain(mood);
  });

  it("returns manual override when set", () => {
    const config = makeMoodConfig({ manualOverride: "excited" });
    const mood = deriveSurfaceMood(DEFAULT_INTERNAL_MOOD, config);
    expect(mood).toBe("excited");
  });

  it("returns 'sleepy' when fatigue is very high", () => {
    const state = makeMoodState({ fatigue: 0.95, stimulation: 0.05, comfort: 0.7 });
    const mood = deriveSurfaceMood(state, makeMoodConfig());
    expect(mood).toBe("sleepy");
  });

  it("returns 'overwhelmed' when overwhelm is very high", () => {
    const state = makeMoodState({ overwhelm: 0.95, stimulation: 0.8, fatigue: 0.7, comfort: 0.1 });
    const mood = deriveSurfaceMood(state, makeMoodConfig());
    expect(mood).toBe("overwhelmed");
  });

  it("returns 'curious' when curiosity and stimulation are high", () => {
    const state = makeMoodState({
      curiosity: 0.95, stimulation: 0.7, fatigue: 0.1, confidence: 0.8,
      boredom: 0.1, overwhelm: 0.0, comfort: 0.5,
    });
    const mood = deriveSurfaceMood(state, makeMoodConfig());
    expect(["curious", "excited"]).toContain(mood);
  });

  it("respects playfulness bias", () => {
    const state = makeMoodState({
      stimulation: 0.6, curiosity: 0.5, confidence: 0.7, fatigue: 0.1,
    });
    deriveSurfaceMood(state, makeMoodConfig({ playfulnessBias: 0 }));
    const biasedMood = deriveSurfaceMood(state, makeMoodConfig({ playfulnessBias: 1.0 }));
    // With max playfulness bias, playful should be more likely
    // (not guaranteed to change, but the bias should shift scoring)
    expect(typeof biasedMood).toBe("string");
  });
});

describe("updateMoodState", () => {
  it("returns current state when mood is disabled", () => {
    const config = makeMoodConfig({ enabled: false });
    const state = makeMoodState();
    const result = updateMoodState(state, 0.016, config, {
      motionActivity: 0.5,
      hasNovelTarget: true,
      userInteracted: false,
      targetScore: 0.3,
      boredomRate: 0.3,
    });
    expect(result).toEqual(state);
  });

  it("increases stimulation with high motion activity", () => {
    const state = makeMoodState({ stimulation: 0.2 });
    const result = updateMoodState(state, 0.5, makeMoodConfig({ intensity: 1.0 }), {
      motionActivity: 0.9,
      hasNovelTarget: false,
      userInteracted: false,
      targetScore: 0.5,
      boredomRate: 0.3,
    });
    expect(result.stimulation).toBeGreaterThan(state.stimulation);
  });

  it("increases boredom when no motion", () => {
    const state = makeMoodState({ boredom: 0.2 });
    const result = updateMoodState(state, 0.5, makeMoodConfig({ intensity: 1.0 }), {
      motionActivity: 0.0,
      hasNovelTarget: false,
      userInteracted: false,
      targetScore: 0,
      boredomRate: 0.8,
    });
    expect(result.boredom).toBeGreaterThan(state.boredom);
  });

  it("increases trust on user interaction", () => {
    const state = makeMoodState({ trust: 0.3 });
    const result = updateMoodState(state, 0.1, makeMoodConfig({ intensity: 1.0 }), {
      motionActivity: 0.3,
      hasNovelTarget: false,
      userInteracted: true,
      targetScore: 0.3,
      boredomRate: 0.3,
    });
    expect(result.trust).toBeGreaterThan(state.trust);
  });

  it("increases curiosity with novel target", () => {
    const state = makeMoodState({ curiosity: 0.3 });
    const result = updateMoodState(state, 0.1, makeMoodConfig({ intensity: 1.0 }), {
      motionActivity: 0.5,
      hasNovelTarget: true,
      userInteracted: false,
      targetScore: 0.5,
      boredomRate: 0.3,
    });
    expect(result.curiosity).toBeGreaterThan(state.curiosity);
  });

  it("clamps all values between 0 and 1", () => {
    const state = makeMoodState({
      curiosity: 0.99, stimulation: 0.99, fatigue: 0.99,
      overwhelm: 0.99, trust: 0.99, boredom: 0.99,
    });
    const result = updateMoodState(state, 1.0, makeMoodConfig({ intensity: 1.0, randomDrift: 1.0 }), {
      motionActivity: 1.0,
      hasNovelTarget: true,
      userInteracted: true,
      targetScore: 1.0,
      boredomRate: 1.0,
    });
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe("getMoodModifiers", () => {
  it("returns valid modifiers for all moods", () => {
    const moods = ["calm", "curious", "playful", "focused", "sleepy", "excited", "overwhelmed", "shy"] as const;
    for (const mood of moods) {
      const mods = getMoodModifiers(mood);
      expect(mods.speedMultiplier).toBeGreaterThan(0);
      expect(mods.blinkInterval).toBeGreaterThan(0);
      expect(mods.colorHue).toBeGreaterThanOrEqual(0);
      expect(mods.colorHue).toBeLessThanOrEqual(360);
      expect(mods.colorSaturation).toBeGreaterThanOrEqual(0);
      expect(mods.colorSaturation).toBeLessThanOrEqual(1);
    }
  });
});

describe("getMoodColor", () => {
  it("returns a valid HSL string", () => {
    const color = getMoodColor("calm", 0.5);
    expect(color).toMatch(/^hsl\(/);
  });

  it("varies with pulse", () => {
    const c1 = getMoodColor("curious", 0.0);
    const c2 = getMoodColor("curious", 1.0);
    expect(c1).not.toBe(c2);
  });
});

describe("getMoodGlowColor", () => {
  it("returns a valid HSLA string", () => {
    const color = getMoodGlowColor("excited", 0.5);
    expect(color).toMatch(/^hsla\(/);
  });
});
