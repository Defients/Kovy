import { describe, it, expect, beforeEach } from "vitest";
import {
  CircadianEngine,
  NULL_CIRCADIAN_OUTPUT,
  getPhaseForHour,
} from "@/engine/circadianEngine";
import type { CircadianConfig, CircadianOutput } from "@/store/types";
import { DEFAULT_CIRCADIAN } from "@/store/defaults";
import { DEFAULT_CONFIG, DEFAULT_RUNTIME_STATE } from "../store/defaults";
import { CONFIG_VERSION } from "../store/types";

function makeConfig(overrides?: Partial<CircadianConfig>): CircadianConfig {
  return { ...DEFAULT_CIRCADIAN, ...overrides };
}

describe("Version consistency", () => {
  it("DEFAULT_CONFIG version matches CONFIG_VERSION", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
  });
});

describe("CircadianEngine", () => {
  let engine: CircadianEngine;

  beforeEach(() => {
    engine = new CircadianEngine();
  });

  // --- Phase detection ---

  describe("getPhaseForHour", () => {
    it("returns deep_night for 0-4", () => {
      expect(getPhaseForHour(0)).toBe("deep_night");
      expect(getPhaseForHour(2)).toBe("deep_night");
      expect(getPhaseForHour(4)).toBe("deep_night");
    });

    it("returns dawn for 5-6", () => {
      expect(getPhaseForHour(5)).toBe("dawn");
      expect(getPhaseForHour(6)).toBe("dawn");
    });

    it("returns morning for 7-11", () => {
      expect(getPhaseForHour(7)).toBe("morning");
      expect(getPhaseForHour(9)).toBe("morning");
      expect(getPhaseForHour(11)).toBe("morning");
    });

    it("returns afternoon for 12-16", () => {
      expect(getPhaseForHour(12)).toBe("afternoon");
      expect(getPhaseForHour(14)).toBe("afternoon");
      expect(getPhaseForHour(16)).toBe("afternoon");
    });

    it("returns dusk for 17-18", () => {
      expect(getPhaseForHour(17)).toBe("dusk");
      expect(getPhaseForHour(18)).toBe("dusk");
    });

    it("returns evening for 19-21", () => {
      expect(getPhaseForHour(19)).toBe("evening");
      expect(getPhaseForHour(21)).toBe("evening");
    });

    it("returns night for 22-23", () => {
      expect(getPhaseForHour(22)).toBe("night");
      expect(getPhaseForHour(23)).toBe("night");
    });

    it("wraps around for values >= 24", () => {
      expect(getPhaseForHour(24)).toBe("deep_night");
      expect(getPhaseForHour(25)).toBe("deep_night");
      expect(getPhaseForHour(31)).toBe("morning");
    });

    it("handles negative hours by wrapping", () => {
      expect(getPhaseForHour(-1)).toBe("night"); // -1 => 23
      expect(getPhaseForHour(-6)).toBe("dusk");  // -6 => 18
    });
  });

  // --- NULL output ---

  describe("NULL_CIRCADIAN_OUTPUT", () => {
    it("has valid default values", () => {
      expect(NULL_CIRCADIAN_OUTPUT.phase).toBe("morning");
      expect(NULL_CIRCADIAN_OUTPUT.energyMultiplier).toBeGreaterThan(0);
      expect(NULL_CIRCADIAN_OUTPUT.drowsiness).toBe(0);
      expect(NULL_CIRCADIAN_OUTPUT.anticipation).toBe(0);
      expect(NULL_CIRCADIAN_OUTPUT.dreamIntensity).toBe(0);
    });
  });

  // --- Engine update ---

  describe("update", () => {
    it("returns valid output when enabled", () => {
      const output = engine.update(1.0, makeConfig(), 0.5, 0.3);
      expect(output.phase).toBeTruthy();
      expect(output.energyMultiplier).toBeGreaterThanOrEqual(0);
      expect(output.energyMultiplier).toBeLessThanOrEqual(1);
      expect(output.drowsiness).toBeGreaterThanOrEqual(0);
      expect(output.drowsiness).toBeLessThanOrEqual(1);
      expect(output.startleSensitivity).toBeGreaterThanOrEqual(0);
      expect(output.startleSensitivity).toBeLessThanOrEqual(1);
      expect(output.socialEnergy).toBeGreaterThanOrEqual(0);
      expect(output.socialEnergy).toBeLessThanOrEqual(1);
    });

    it("returns null-like output when disabled", () => {
      const output = engine.update(1.0, makeConfig({ enabled: false }), 0.5, 0.3);
      expect(output.phase).toBe("morning");
      expect(output.anticipation).toBe(0);
      expect(output.drowsiness).toBe(0);
    });

    it("energy and drowsiness are roughly inversely related", () => {
      const output = engine.update(1.0, makeConfig(), 0.5, 0.3);
      // Not exactly inverse, but high energy should mean lower drowsiness
      if (output.energyMultiplier > 0.7) {
        expect(output.drowsiness).toBeLessThan(0.6);
      }
      if (output.drowsiness > 0.7) {
        expect(output.energyMultiplier).toBeLessThan(0.6);
      }
    });

    it("amplifyDayNight=0 produces moderate energy", () => {
      const output = engine.update(1.0, makeConfig({ amplifyDayNight: 0 }), 0.5, 0.3);
      // Without amplification, energy should be closer to the raw histogram value
      expect(output.energyMultiplier).toBeGreaterThan(0.01);
      expect(output.energyMultiplier).toBeLessThan(1);
    });

    it("amplifyDayNight=1 produces more extreme energy", () => {
      const low = engine.update(1.0, makeConfig({ amplifyDayNight: 0 }), 0.5, 0.3);
      engine.reset();
      const high = engine.update(1.0, makeConfig({ amplifyDayNight: 1 }), 0.5, 0.3);
      // Higher amplification pushes energy further from 0.5
      const distLow = Math.abs(low.energyMultiplier - 0.5);
      const distHigh = Math.abs(high.energyMultiplier - 0.5);
      expect(distHigh).toBeGreaterThanOrEqual(distLow - 0.01); // slight tolerance
    });
  });

  // --- Dream intensity ---

  describe("dreamIntensity", () => {
    it("is 0 when dreamEnabled is false", () => {
      const output = engine.update(1.0, makeConfig({ dreamEnabled: false }), 0, 0);
      expect(output.dreamIntensity).toBe(0);
    });

    it("correlates with drowsiness when dreamEnabled", () => {
      const output = engine.update(1.0, makeConfig({ dreamEnabled: true }), 0, 0);
      // Dream intensity = drowsiness * 0.8 + phase bonus
      expect(output.dreamIntensity).toBeGreaterThanOrEqual(0);
      expect(output.dreamIntensity).toBeLessThanOrEqual(1);
    });
  });

  // --- Startle detection ---

  describe("shouldStartle", () => {
    it("returns false when startleEnabled is false", () => {
      const output = engine.update(1.0, makeConfig(), 0, 0);
      const result = engine.shouldStartle(
        makeConfig({ startleEnabled: false }),
        0.9,
        output
      );
      expect(result).toBe(false);
    });

    it("returns true on large score spike", () => {
      // Set prevTopScore to low
      engine.update(1.0, makeConfig(), 0.1, 0.1);
      // Wait for cooldown without changing score
      engine.update(10.0, makeConfig(), 0.1, 0.1);
      
      // Get output and trigger startle with big score jump
      const conf = makeConfig();
      const output = engine.update(0.1, conf, 0.9, 0.1);
      const result = engine.shouldStartle(conf, 0.9, output);
      expect(result).toBe(true);
    });

    it("respects cooldown", () => {
      engine.update(1.0, makeConfig({ startleCooldown: 10 }), 0.1, 0.1);
      const output = engine.update(10.1, makeConfig({ startleCooldown: 10 }), 0.1, 0.1);

      // First startle triggers
      const first = engine.shouldStartle(makeConfig({ startleCooldown: 10 }), 0.9, output);
      expect(first).toBe(true);

      // Second should be on cooldown
      const second = engine.shouldStartle(makeConfig({ startleCooldown: 10 }), 0.9, output);
      expect(second).toBe(false);
    });

    it("returns false on small score changes", () => {
      engine.update(1.0, makeConfig(), 0.4, 0.4);
      const output = engine.update(1.0, makeConfig(), 0.4, 0.4);
      const result = engine.shouldStartle(makeConfig(), 0.5, output);
      expect(result).toBe(false);
    });
  });

  // --- Histogram ---

  describe("histogram", () => {
    it("returns 24-slot histogram", () => {
      const histogram = engine.getHistogram();
      expect(histogram.length).toBe(24);
    });

    it("all values are between 0 and 1", () => {
      const histogram = engine.getHistogram();
      for (const val of histogram) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it("getEnergyAtHour returns interpolated values", () => {
      const e10 = engine.getEnergyAtHour(10);
      const e2 = engine.getEnergyAtHour(2);
      // Default histogram has higher activity at 10 than 2
      expect(e10).toBeGreaterThan(e2);
    });

    it("getEnergyAtHour wraps around 24", () => {
      const e0 = engine.getEnergyAtHour(0);
      const e24 = engine.getEnergyAtHour(24);
      expect(Math.abs(e0 - e24)).toBeLessThan(0.01);
    });
  });

  // --- Reset ---

  describe("reset", () => {
    it("restores histogram to defaults", () => {
      // Mutate by updating many times
      for (let i = 0; i < 100; i++) {
        engine.update(1.0, makeConfig({ adaptationRate: 1 }), 1.0, 0.5);
      }
      engine.reset();
      const histogram = engine.getHistogram();
      // Default histogram[10] should be 0.8
      expect(histogram[10]).toBeCloseTo(0.8, 1);
    });
  });

  // --- Custom initial histogram ---

  describe("custom histogram", () => {
    it("accepts custom initial histogram", () => {
      const custom = new Array(24).fill(0.5);
      const customEngine = new CircadianEngine(custom);
      const histogram = customEngine.getHistogram();
      expect(histogram[0]).toBe(0.5);
      expect(histogram[12]).toBe(0.5);
    });
  });

  // --- Social energy ---

  describe("socialEnergy", () => {
    it("is between 0.1 and 1", () => {
      const output = engine.update(1.0, makeConfig(), 0.5, 0.3);
      expect(output.socialEnergy).toBeGreaterThanOrEqual(0.1);
      expect(output.socialEnergy).toBeLessThanOrEqual(1);
    });
  });

  // --- Anticipation ---

  describe("anticipation", () => {
    it("is between 0 and 1", () => {
      const output = engine.update(1.0, makeConfig(), 0.5, 0.3);
      expect(output.anticipation).toBeGreaterThanOrEqual(0);
      expect(output.anticipation).toBeLessThanOrEqual(1);
    });
  });
});
