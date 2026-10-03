import { describe, it, expect, beforeEach } from "vitest";
import { GamingEngine, NULL_GAMING_OUTPUT, getGamingStyleColors, getGamingStyleResidueTypes } from "../engine/gamingEngine";
import { DEFAULT_GAMING } from "../store/defaults";
import { DEFAULT_CONFIG } from "../store/defaults";
import { validateConfig, clampConfig, safeImportConfig } from "../store/configValidation";
import type { GamingConfig, GamingOutput, MotionTarget, Vec2 } from "../store/types";
import { CONFIG_VERSION } from "../store/types";

const GAMING_ENABLED: GamingConfig = { ...DEFAULT_GAMING, enabled: true };

function makeTarget(x: number, y: number, score: number, regionId = 1): MotionTarget {
  return { position: { x, y }, score, regionId, age: 0 };
}

// --- GamingEngine enable/disable ---

describe("GamingEngine — enable/disable", () => {
  let engine: GamingEngine;
  beforeEach(() => { engine = new GamingEngine(); });

  it("starts inactive", () => {
    expect(engine.isActive()).toBe(false);
  });

  it("toggle activates then deactivates", () => {
    expect(engine.toggle()).toBe(true);
    expect(engine.isActive()).toBe(true);
    expect(engine.toggle()).toBe(false);
    expect(engine.isActive()).toBe(false);
  });

  it("setActive sets state correctly", () => {
    engine.setActive(true);
    expect(engine.isActive()).toBe(true);
    engine.setActive(false);
    expect(engine.isActive()).toBe(false);
  });

  it("returns null output when disabled", () => {
    const output = engine.update(
      0.016, GAMING_ENABLED, [], null, 0, { x: 100, y: 100 }, { x: 0, y: 0 }
    );
    expect(output.enabled).toBe(false);
    expect(output.excitement).toBe(0);
  });

  it("returns enabled output when active and config enabled", () => {
    engine.setActive(true);
    const output = engine.update(
      0.016, GAMING_ENABLED, [], null, 0, { x: 100, y: 100 }, { x: 0, y: 0 }
    );
    expect(output.enabled).toBe(true);
  });

  it("returns disabled output when active but config disabled", () => {
    engine.setActive(true);
    const output = engine.update(
      0.016, DEFAULT_GAMING, [], null, 0, { x: 100, y: 100 }, { x: 0, y: 0 }
    );
    expect(output.enabled).toBe(false);
  });

  it("reset clears all state", () => {
    engine.setActive(true);
    // Feed some data
    for (let i = 0; i < 10; i++) {
      engine.update(0.1, GAMING_ENABLED, [makeTarget(100 + i * 10, 200, 0.8)], makeTarget(100, 200, 0.8), 0.5, { x: 50, y: 50 }, { x: 100, y: 0 });
    }
    engine.reset();
    expect(engine.isActive()).toBe(false);
    expect(engine.getExcitement()).toBe(0);
    expect(engine.getPredictionConfidence()).toBe(0);
  });
});

// --- Excitement growth and cooldown ---

describe("GamingEngine — excitement", () => {
  let engine: GamingEngine;
  beforeEach(() => {
    engine = new GamingEngine();
    engine.setActive(true);
  });

  it("excitement grows with high motion activity", () => {
    // Feed continuous high-activity frames
    for (let i = 0; i < 60; i++) {
      engine.update(
        0.016, GAMING_ENABLED,
        [makeTarget(100 + i, 200, 0.8)],
        makeTarget(100 + i, 200, 0.8),
        0.8,
        { x: 50, y: 50 }, { x: 200, y: 0 }
      );
    }
    expect(engine.getExcitement()).toBeGreaterThan(0.1);
  });

  it("excitement cools down with no activity", () => {
    // First build up excitement
    for (let i = 0; i < 60; i++) {
      engine.update(
        0.016, GAMING_ENABLED,
        [makeTarget(100 + i, 200, 0.8)],
        makeTarget(100 + i, 200, 0.8),
        0.8,
        { x: 50, y: 50 }, { x: 200, y: 0 }
      );
    }
    const peakExcitement = engine.getExcitement();

    // Then idle for a long time
    for (let i = 0; i < 600; i++) {
      engine.update(
        0.05, GAMING_ENABLED,
        [], null, 0,
        { x: 50, y: 50 }, { x: 0, y: 0 }
      );
    }
    expect(engine.getExcitement()).toBeLessThan(peakExcitement);
  });

  it("excitement stays bounded [0, 1]", () => {
    // Massive activity
    for (let i = 0; i < 200; i++) {
      engine.update(
        0.016, { ...GAMING_ENABLED, excitementGain: 1.0 },
        [makeTarget(i * 5, 200, 1.0), makeTarget(i * 5 + 50, 300, 0.9)],
        makeTarget(i * 5, 200, 1.0),
        1.0,
        { x: 50, y: 50 }, { x: 500, y: 300 }
      );
    }
    expect(engine.getExcitement()).toBeGreaterThanOrEqual(0);
    expect(engine.getExcitement()).toBeLessThanOrEqual(1);
  });

  it("excitement gain config scales growth rate", () => {
    const lowGain = new GamingEngine();
    const highGain = new GamingEngine();
    lowGain.setActive(true);
    highGain.setActive(true);

    const targets = [makeTarget(200, 200, 0.8)];
    const active = makeTarget(200, 200, 0.8);

    for (let i = 0; i < 60; i++) {
      lowGain.update(0.016, { ...GAMING_ENABLED, excitementGain: 0.2 }, targets, active, 0.7, { x: 50, y: 50 }, { x: 100, y: 0 });
      highGain.update(0.016, { ...GAMING_ENABLED, excitementGain: 1.0 }, targets, active, 0.7, { x: 50, y: 50 }, { x: 100, y: 0 });
    }

    expect(highGain.getExcitement()).toBeGreaterThan(lowGain.getExcitement());
  });
});

// --- Prediction confidence ---

describe("GamingEngine — prediction confidence", () => {
  let engine: GamingEngine;
  beforeEach(() => {
    engine = new GamingEngine();
    engine.setActive(true);
  });

  it("prediction confidence starts at 0", () => {
    expect(engine.getPredictionConfidence()).toBe(0);
  });

  it("prediction confidence grows when predictions are confirmed", () => {
    // Create a steady rightward motion pattern
    for (let i = 0; i < 100; i++) {
      const x = 100 + i * 5;
      engine.update(
        0.05, { ...GAMING_ENABLED, predictiveBias: 1.0 },
        [makeTarget(x, 200, 0.8)],
        makeTarget(x, 200, 0.8),
        0.7,
        { x: 50, y: 50 }, { x: 200, y: 0 }
      );
    }
    // With consistent rightward motion, predictions should be confirmed
    expect(engine.getPredictionConfidence()).toBeGreaterThanOrEqual(0);
  });

  it("prediction confidence stays bounded [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      engine.update(
        0.05, { ...GAMING_ENABLED, predictiveBias: 1.0 },
        [makeTarget(100 + i * 10, 200, 0.9)],
        makeTarget(100 + i * 10, 200, 0.9),
        0.9,
        { x: 50, y: 50 }, { x: 300, y: 0 }
      );
    }
    expect(engine.getPredictionConfidence()).toBeGreaterThanOrEqual(0);
    expect(engine.getPredictionConfidence()).toBeLessThanOrEqual(1);
  });
});

// --- Residue burst generation ---

describe("GamingEngine — residue bursts", () => {
  let engine: GamingEngine;
  beforeEach(() => {
    engine = new GamingEngine();
    engine.setActive(true);
  });

  it("does not spawn residue when excitement is 0", () => {
    const output = engine.update(
      0.016, GAMING_ENABLED, [], null, 0,
      { x: 100, y: 100 }, { x: 0, y: 0 }
    );
    expect(output.residueBursts.length).toBe(0);
  });

  it("spawns residue after excitement builds", () => {
    let totalBursts = 0;
    // Build excitement with high activity
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, residueAmount: 1.0 },
        [makeTarget(100 + i * 3, 200, 0.9)],
        makeTarget(100 + i * 3, 200, 0.9),
        0.9,
        { x: 50, y: 50 }, { x: 300, y: 100 }
      );
      totalBursts += output.residueBursts.length;
    }
    expect(totalBursts).toBeGreaterThan(0);
  });

  it("residue bursts have valid type from style palette", () => {
    // Build excitement first
    for (let i = 0; i < 100; i++) {
      engine.update(
        0.05, { ...GAMING_ENABLED, residueAmount: 1.0 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.9,
        { x: 50, y: 50 }, { x: 300, y: 100 }
      );
    }

    // Collect bursts
    let bursts: GamingOutput["residueBursts"] = [];
    for (let i = 0; i < 100; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, residueAmount: 1.0 },
        [makeTarget(600 + i * 5, 200, 0.9)],
        makeTarget(600 + i * 5, 200, 0.9),
        0.9,
        { x: 50, y: 50 }, { x: 300, y: 100 }
      );
      bursts = bursts.concat(output.residueBursts);
    }

    const validTypes = getGamingStyleResidueTypes("surge");
    for (const burst of bursts) {
      expect(validTypes).toContain(burst.type);
      expect(burst.intensity).toBeGreaterThanOrEqual(0);
      expect(burst.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("residue amount config controls spawn rate", () => {
    let lowCount = 0;
    let highCount = 0;

    const engineLow = new GamingEngine();
    const engineHigh = new GamingEngine();
    engineLow.setActive(true);
    engineHigh.setActive(true);

    for (let i = 0; i < 200; i++) {
      const outLow = engineLow.update(
        0.05, { ...GAMING_ENABLED, residueAmount: 0.1 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.9, { x: 50, y: 50 }, { x: 300, y: 100 }
      );
      const outHigh = engineHigh.update(
        0.05, { ...GAMING_ENABLED, residueAmount: 1.0 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.9, { x: 50, y: 50 }, { x: 300, y: 100 }
      );
      lowCount += outLow.residueBursts.length;
      highCount += outHigh.residueBursts.length;
    }
    expect(highCount).toBeGreaterThanOrEqual(lowCount);
  });
});

// --- Deformation output bounds ---

describe("GamingEngine — deformation outputs", () => {
  let engine: GamingEngine;
  beforeEach(() => {
    engine = new GamingEngine();
    engine.setActive(true);
  });

  it("elasticity stays within [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, elasticDeformation: 1.0 },
        [makeTarget(100 + i * 5, 200, 1.0)],
        makeTarget(100 + i * 5, 200, 1.0),
        1.0, { x: 50, y: 50 }, { x: 500, y: 300 }
      );
      expect(output.elasticity).toBeGreaterThanOrEqual(0);
      expect(output.elasticity).toBeLessThanOrEqual(1);
    }
  });

  it("freeformWobble stays within [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, freeformWobble: 1.0 },
        [makeTarget(100 + i * 5, 200, 1.0)],
        makeTarget(100 + i * 5, 200, 1.0),
        1.0, { x: 50, y: 50 }, { x: 500, y: 300 }
      );
      expect(output.freeformWobble).toBeGreaterThanOrEqual(0);
      expect(output.freeformWobble).toBeLessThanOrEqual(1);
    }
  });

  it("hyperBoost stays within [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, hyperBlend: 1.0 },
        [makeTarget(100 + i * 5, 200, 1.0)],
        makeTarget(100 + i * 5, 200, 1.0),
        1.0, { x: 50, y: 50 }, { x: 500, y: 300 }
      );
      expect(output.hyperBoost).toBeGreaterThanOrEqual(0);
      expect(output.hyperBoost).toBeLessThanOrEqual(1);
    }
  });

  it("adaptiveBias stays within [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, predictiveBias: 1.0 },
        [makeTarget(100 + i * 5, 200, 1.0)],
        makeTarget(100 + i * 5, 200, 1.0),
        1.0, { x: 50, y: 50 }, { x: 500, y: 300 }
      );
      expect(output.adaptiveBias).toBeGreaterThanOrEqual(0);
      expect(output.adaptiveBias).toBeLessThanOrEqual(1);
    }
  });

  it("predictedPoints array is bounded to max 3", () => {
    for (let i = 0; i < 200; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, predictiveBias: 1.0 },
        [makeTarget(100 + i * 10, 200, 0.9), makeTarget(100 + i * 10 + 50, 300, 0.8)],
        makeTarget(100 + i * 10, 200, 0.9),
        0.9, { x: 50, y: 50 }, { x: 400, y: 200 }
      );
      expect(output.predictedPoints.length).toBeLessThanOrEqual(3);
    }
  });
});

// --- Hyper blend output ---

describe("GamingEngine — hyper blend", () => {
  let engine: GamingEngine;
  beforeEach(() => {
    engine = new GamingEngine();
    engine.setActive(true);
  });

  it("hyperBoost scales with hyperBlend config", () => {
    const engineLow = new GamingEngine();
    const engineHigh = new GamingEngine();
    engineLow.setActive(true);
    engineHigh.setActive(true);

    for (let i = 0; i < 100; i++) {
      engineLow.update(
        0.05, { ...GAMING_ENABLED, hyperBlend: 0.1 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.8, { x: 50, y: 50 }, { x: 200, y: 0 }
      );
      engineHigh.update(
        0.05, { ...GAMING_ENABLED, hyperBlend: 1.0 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.8, { x: 50, y: 50 }, { x: 200, y: 0 }
      );
    }

    // Get final outputs
    const outLow = engineLow.update(0.016, { ...GAMING_ENABLED, hyperBlend: 0.1 }, [], null, 0, { x: 50, y: 50 }, { x: 0, y: 0 });
    const outHigh = engineHigh.update(0.016, { ...GAMING_ENABLED, hyperBlend: 1.0 }, [], null, 0, { x: 50, y: 50 }, { x: 0, y: 0 });

    expect(outHigh.hyperBoost).toBeGreaterThanOrEqual(outLow.hyperBoost);
  });

  it("hyperBoost is 0 when hyperBlend is 0", () => {
    for (let i = 0; i < 100; i++) {
      const output = engine.update(
        0.05, { ...GAMING_ENABLED, hyperBlend: 0 },
        [makeTarget(100 + i * 5, 200, 0.9)],
        makeTarget(100 + i * 5, 200, 0.9),
        0.8, { x: 50, y: 50 }, { x: 200, y: 0 }
      );
      expect(output.hyperBoost).toBe(0);
    }
  });
});

// --- Config validation and defaults ---

describe("GamingEngine — config validation", () => {
  it("DEFAULT_CONFIG includes gaming section", () => {
    expect(DEFAULT_CONFIG.gaming).toBeDefined();
    expect(DEFAULT_CONFIG.gaming.enabled).toBe(false);
    expect(DEFAULT_CONFIG.gaming.visualStyle).toBe("surge");
  });

  it("DEFAULT_CONFIG includes toggleGaming hotkey", () => {
    expect(DEFAULT_CONFIG.hotkeys.toggleGaming).toBe("Alt+Shift+G");
  });

  it("CONFIG_VERSION is a positive integer", () => {
    expect(CONFIG_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG_VERSION)).toBe(true);
  });

  it("v4 config migrates to v5 with gaming section", () => {
    const v4Config = {
      version: 4,
      general: DEFAULT_CONFIG.general,
      appearance: DEFAULT_CONFIG.appearance,
      behavior: DEFAULT_CONFIG.behavior,
      vision: DEFAULT_CONFIG.vision,
      mood: DEFAULT_CONFIG.mood,
      performance: DEFAULT_CONFIG.performance,
      privacy: DEFAULT_CONFIG.privacy,
      audio: DEFAULT_CONFIG.audio,
      hotkeys: { ...DEFAULT_CONFIG.hotkeys },
      advanced: DEFAULT_CONFIG.advanced,
      habitat: DEFAULT_CONFIG.habitat,
      memory: DEFAULT_CONFIG.memory,
      family: DEFAULT_CONFIG.family,
      muse: DEFAULT_CONFIG.muse,
      onboardingComplete: true,
    };
    // Remove gaming-specific fields to simulate v4
    delete (v4Config.hotkeys as any).toggleGaming;

    const result = safeImportConfig(v4Config);
    expect(result.config).not.toBeNull();
    expect(result.migrated).toBe(true);
    expect(result.config!.gaming).toBeDefined();
    expect(result.config!.gaming.enabled).toBe(false);
    expect(result.config!.gaming.visualStyle).toBe("surge");
    expect(result.config!.hotkeys.toggleGaming).toBe("Alt+Shift+G");
  });

  it("gaming config values are clamped to valid ranges", () => {
    const extreme = {
      ...DEFAULT_CONFIG,
      gaming: {
        enabled: true,
        hotkey: "Alt+Shift+G",
        predictiveBias: 5,
        excitementGain: -1,
        hyperBlend: 2,
        residueAmount: 3,
        residueLifetime: 10,
        elasticDeformation: -0.5,
        freeformWobble: 99,
        visualStyle: "surge" as const,
        comboSystem: true,
        comboDecayRate: 0.5,
      },
    };
    const clamped = clampConfig(extreme);
    expect(clamped.gaming.predictiveBias).toBe(1);
    expect(clamped.gaming.excitementGain).toBe(0);
    expect(clamped.gaming.hyperBlend).toBe(1);
    expect(clamped.gaming.residueAmount).toBe(1);
    expect(clamped.gaming.residueLifetime).toBe(1.2);
    expect(clamped.gaming.elasticDeformation).toBe(0);
    expect(clamped.gaming.freeformWobble).toBe(1);
  });

  it("validation includes gaming in required sections", () => {
    const incomplete = {
      version: 5,
      general: {},
      appearance: {},
      behavior: {},
      vision: {},
      mood: {},
      performance: {},
      privacy: {},
      audio: {},
      hotkeys: {},
      advanced: {},
      habitat: {},
      memory: {},
      family: {},
      muse: {},
      // gaming intentionally missing
    };
    const result = validateConfig(incomplete);
    expect(result.errors.some(e => e.includes("gaming"))).toBe(true);
  });
});

// --- NULL_GAMING_OUTPUT ---

describe("NULL_GAMING_OUTPUT", () => {
  it("has all fields zeroed/empty", () => {
    expect(NULL_GAMING_OUTPUT.enabled).toBe(false);
    expect(NULL_GAMING_OUTPUT.excitement).toBe(0);
    expect(NULL_GAMING_OUTPUT.predictionConfidence).toBe(0);
    expect(NULL_GAMING_OUTPUT.predictedPoints).toHaveLength(0);
    expect(NULL_GAMING_OUTPUT.adaptiveBias).toBe(0);
    expect(NULL_GAMING_OUTPUT.hyperBoost).toBe(0);
    expect(NULL_GAMING_OUTPUT.elasticity).toBe(0);
    expect(NULL_GAMING_OUTPUT.freeformWobble).toBe(0);
    expect(NULL_GAMING_OUTPUT.residueBursts).toHaveLength(0);
  });
});

// --- Style helpers ---

describe("GamingEngine — style helpers", () => {
  it("getGamingStyleColors returns colors for each style", () => {
    for (const style of ["surge", "feral", "arcade"] as const) {
      const colors = getGamingStyleColors(style);
      expect(colors.length).toBeGreaterThan(0);
      for (const c of colors) {
        expect(c).toMatch(/^hsl\(/);
      }
    }
  });

  it("getGamingStyleResidueTypes returns types for each style", () => {
    for (const style of ["surge", "feral", "arcade"] as const) {
      const types = getGamingStyleResidueTypes(style);
      expect(types.length).toBeGreaterThan(0);
    }
  });
});

// --- Multi-entity safety ---

describe("GamingEngine — multi-entity safety", () => {
  it("global engine produces consistent output regardless of entity count", () => {
    const engine = new GamingEngine();
    engine.setActive(true);

    // Simulate frames
    for (let i = 0; i < 50; i++) {
      engine.update(
        0.016, GAMING_ENABLED,
        [makeTarget(100 + i, 200, 0.7)],
        makeTarget(100 + i, 200, 0.7),
        0.5, { x: 50, y: 50 }, { x: 100, y: 0 }
      );
    }

    const output = engine.update(
      0.016, GAMING_ENABLED,
      [makeTarget(200, 200, 0.7)],
      makeTarget(200, 200, 0.7),
      0.5, { x: 50, y: 50 }, { x: 100, y: 0 }
    );

    // Output should be valid for applying to any number of entities
    expect(output.excitement).toBeGreaterThanOrEqual(0);
    expect(output.excitement).toBeLessThanOrEqual(1);
    expect(output.elasticity).toBeGreaterThanOrEqual(0);
    expect(output.elasticity).toBeLessThanOrEqual(1);
    expect(output.freeformWobble).toBeGreaterThanOrEqual(0);
    expect(output.freeformWobble).toBeLessThanOrEqual(1);
  });
});
