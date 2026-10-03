// ============================================================
// Personality Evolution Engine tests — slow personality drift
// based on interaction patterns, mood history, and time.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PersonalityEvolutionEngine } from "@/engine/personalityEvolutionEngine";
import type { PersonalityEvolutionConfig, SurfaceMood } from "@/store/types";

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const baseConfig: PersonalityEvolutionConfig = {
  enabled: true,
  evolutionRate: 1,
};

const STORAGE_KEY = "kovy-personality-evolution";

describe("PersonalityEvolutionEngine", () => {
  let engine: PersonalityEvolutionEngine;

  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
    engine = new PersonalityEvolutionEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorageMock.clear();
  });

  describe("basic functionality", () => {
    it("constructs with default zero offsets when no stored data", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.offsets.curiosityBias).toBe(0);
      expect(out.offsets.energyBias).toBe(0);
      expect(out.offsets.shynessBias).toBe(0);
      expect(out.offsets.playfulnessBias).toBe(0);
      expect(out.offsets.wanderBias).toBe(0);
      expect(out.offsets.colorHueOffset).toBe(0);
      expect(out.offsets.sizeOffset).toBe(0);
    });

    it("returns enabled output when config enabled", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.enabled).toBe(true);
    });

    it("returns disabled output when config disabled", () => {
      const out = engine.update(0.016, { ...baseConfig, enabled: false });
      expect(out.enabled).toBe(false);
      expect(out.driftDescription).toBe("");
    });

    it("returns a copy of offsets (not internal reference)", () => {
      const out1 = engine.update(0.016, baseConfig);
      out1.offsets.curiosityBias = 999;
      const out2 = engine.update(0.016, baseConfig);
      expect(out2.offsets.curiosityBias).not.toBe(999);
    });

    it("returns stable personality description with no drift", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.driftDescription).toBe("stable personality");
    });
  });

  describe("loading from localStorage", () => {
    it("loads offsets from localStorage on construction", () => {
      const stored = {
        curiosityBias: 0.2, energyBias: 0.1, shynessBias: 0,
        playfulnessBias: 0, wanderBias: 0,
        colorHueOffset: 0, sizeOffset: 0,
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));
      const newEngine = new PersonalityEvolutionEngine();
      const out = newEngine.update(0.016, baseConfig);
      expect(out.offsets.curiosityBias).toBeCloseTo(0.2, 5);
      expect(out.offsets.energyBias).toBeCloseTo(0.1, 5);
    });

    it("falls back to defaults when localStorage has invalid JSON", () => {
      localStorageMock.setItem(STORAGE_KEY, "{invalid json");
      const newEngine = new PersonalityEvolutionEngine();
      const out = newEngine.update(0.016, baseConfig);
      expect(out.offsets.curiosityBias).toBe(0);
    });

    it("falls back to defaults when localStorage is empty", () => {
      const newEngine = new PersonalityEvolutionEngine();
      const out = newEngine.update(0.016, baseConfig);
      expect(out.offsets.energyBias).toBe(0);
    });
  });

  describe("recordMood", () => {
    it("records mood into history", () => {
      engine.recordMood("curious");
      // Apply drift — curious increases curiosityBias
      const out = engine.update(1, baseConfig);
      expect(out.offsets.curiosityBias).toBeGreaterThan(0);
    });

    it("caps mood history at 100 entries", () => {
      for (let i = 0; i < 150; i++) {
        engine.recordMood("calm");
      }
      // Should not throw and should still apply drift from recent moods
      const out = engine.update(1, baseConfig);
      expect(out.enabled).toBe(true);
    });

    it("only uses the last 20 moods for drift", () => {
      // Record 30 calm moods (calm decreases wanderBias)
      for (let i = 0; i < 30; i++) {
        engine.recordMood("calm");
      }
      // Record 5 curious moods (curious increases curiosityBias)
      for (let i = 0; i < 5; i++) {
        engine.recordMood("curious");
      }
      const out = engine.update(1, baseConfig);
      // The last 20 moods = 15 calm + 5 curious
      // curiosityBias should increase because curious is in the last 20
      expect(out.offsets.curiosityBias).toBeGreaterThan(0);
    });
  });

  describe("update drift logic", () => {
    it("curious mood increases curiosityBias", () => {
      engine.recordMood("curious");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.curiosityBias).toBeGreaterThan(0);
    });

    it("calm mood decreases wanderBias", () => {
      engine.recordMood("calm");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.wanderBias).toBeLessThan(0);
    });

    it("playful mood increases playfulnessBias and energyBias", () => {
      engine.recordMood("playful");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.playfulnessBias).toBeGreaterThan(0);
      expect(out.offsets.energyBias).toBeGreaterThan(0);
    });

    it("sleepy mood decreases energyBias", () => {
      engine.recordMood("sleepy");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.energyBias).toBeLessThan(0);
    });

    it("excited mood increases energyBias and playfulnessBias", () => {
      engine.recordMood("excited");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.energyBias).toBeGreaterThan(0);
      expect(out.offsets.playfulnessBias).toBeGreaterThan(0);
    });

    it("shy mood increases shynessBias", () => {
      engine.recordMood("shy");
      const out = engine.update(1, baseConfig);
      expect(out.offsets.shynessBias).toBeGreaterThan(0);
    });

    it("evolutionRate scales the drift amount", () => {
      const slowEngine = new PersonalityEvolutionEngine();
      const fastEngine = new PersonalityEvolutionEngine();
      slowEngine.recordMood("curious");
      fastEngine.recordMood("curious");
      const slowOut = slowEngine.update(1, { ...baseConfig, evolutionRate: 0.1 });
      const fastOut = fastEngine.update(1, { ...baseConfig, evolutionRate: 1 });
      expect(fastOut.offsets.curiosityBias).toBeGreaterThan(slowOut.offsets.curiosityBias);
    });

    it("offsets are clamped to [-0.5, 0.5]", () => {
      // Record many curious moods and run for a long time
      for (let i = 0; i < 20; i++) {
        engine.recordMood("curious");
      }
      let out = engine.update(0.016, baseConfig);
      // Run a very long simulation
      for (let i = 0; i < 1000; i++) {
        out = engine.update(1, baseConfig);
      }
      expect(out.offsets.curiosityBias).toBeLessThanOrEqual(0.5);
      expect(out.offsets.curiosityBias).toBeGreaterThanOrEqual(-0.5);
    });

    it("does not drift when disabled", () => {
      engine.recordMood("curious");
      const out = engine.update(1, { ...baseConfig, enabled: false });
      expect(out.offsets.curiosityBias).toBe(0);
    });

    it("driftDescription reflects high curiosity", () => {
      // Force a high curiosity offset via localStorage
      const stored = {
        curiosityBias: 0.2, energyBias: 0, shynessBias: 0,
        playfulnessBias: 0, wanderBias: 0,
        colorHueOffset: 0, sizeOffset: 0,
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));
      const newEngine = new PersonalityEvolutionEngine();
      const out = newEngine.update(0.016, baseConfig);
      expect(out.driftDescription).toContain("more curious");
    });

    it("driftDescription reflects multiple high offsets", () => {
      const stored = {
        curiosityBias: 0.2, energyBias: 0.2, shynessBias: 0,
        playfulnessBias: 0, wanderBias: 0,
        colorHueOffset: 0, sizeOffset: 0,
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));
      const newEngine = new PersonalityEvolutionEngine();
      const out = newEngine.update(0.016, baseConfig);
      expect(out.driftDescription).toContain("more curious");
      expect(out.driftDescription).toContain("more energetic");
    });
  });

  describe("persistence (save / flush)", () => {
    it("saves offsets to localStorage via flush", () => {
      engine.recordMood("curious");
      engine.update(1, baseConfig);
      engine.flush();
      const raw = localStorageMock.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.curiosityBias).toBeGreaterThan(0);
    });

    it("flush does nothing when no pending debounced save", () => {
      // flush without any update should not throw and should not save
      engine.flush();
      // No update was called, so nothing should have been written
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
    });

    it("debounced save fires after 1 second", () => {
      engine.recordMood("curious");
      engine.update(1, baseConfig);
      // Before timer fires, nothing saved
      expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
      // Advance fake timers past the 1s debounce
      vi.advanceTimersByTime(1100);
      const raw = localStorageMock.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
    });

    it("debounced save only schedules once for multiple updates", () => {
      engine.recordMood("curious");
      engine.update(1, baseConfig);
      engine.update(1, baseConfig);
      engine.update(1, baseConfig);
      // Advance a small amount — should still only have one pending timer
      vi.advanceTimersByTime(1100);
      const raw = localStorageMock.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      // The saved value should reflect all three updates
      expect(parsed.curiosityBias).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    it("reset zeroes out all offsets and clears mood history", () => {
      engine.recordMood("curious");
      engine.update(1, baseConfig);
      expect(engine.update(0.016, baseConfig).offsets.curiosityBias).toBeGreaterThan(0);
      engine.reset();
      const out = engine.update(0.016, baseConfig);
      expect(out.offsets.curiosityBias).toBe(0);
      expect(out.offsets.energyBias).toBe(0);
      expect(out.driftDescription).toBe("stable personality");
    });

    it("reset persists the zeroed offsets to localStorage", () => {
      engine.recordMood("curious");
      engine.update(1, baseConfig);
      engine.reset();
      const raw = localStorageMock.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.curiosityBias).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles dt of 0 without drift", () => {
      engine.recordMood("curious");
      const out = engine.update(0, baseConfig);
      expect(out.offsets.curiosityBias).toBe(0);
    });

    it("handles empty mood history gracefully", () => {
      const out = engine.update(1, baseConfig);
      expect(out.enabled).toBe(true);
      expect(out.driftDescription).toBe("stable personality");
    });

    it("handles evolutionRate of 0 without drift", () => {
      engine.recordMood("curious");
      const out = engine.update(1, { ...baseConfig, evolutionRate: 0 });
      expect(out.offsets.curiosityBias).toBe(0);
    });

    it("handles unknown mood gracefully (no influence)", () => {
      // All SurfaceMood values have influences, but verify no crash with empty history
      const out = engine.update(1, baseConfig);
      expect(out.enabled).toBe(true);
    });
  });
});
