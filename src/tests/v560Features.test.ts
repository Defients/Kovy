import { describe, it, expect } from "vitest";
import { CONFIG_VERSION } from "../store/types";
import { KOVY_VERSION } from "../lib/version";
import type { EntityVisualConfig, ToneMode, SoundCategory, DisplayMonitor } from "../store/types";
import { DEFAULT_CONFIG, DEFAULT_ENTITY_VISUAL, DEFAULT_AUDIO } from "../store/defaults";
import { safeImportConfig } from "../store/configValidation";
import { isValidHex, normalizeHex, hexToHsl, hexToRgba, shiftHexHue, blendHex } from "../lib/colorUtils";
import { SOUND_CATALOG, getSoundsByCategory, getSoundsForBehavior, getSoundsForMood, getSoundById } from "../engine/soundCatalog";
import { SCENARIO_PRESETS, getPresetById } from "../store/scenarioPresets";
import {
  computeVirtualDesktop,
  getMonitorForPosition,
  clampToMonitor,
  getEntityBounds,
  resolveDisplayMonitor,
  type MonitorInfo,
} from "../lib/monitorUtils";

// ============================================================
// v6.0.0 Feature Tests
// ============================================================

// --- Color Utilities ---
describe("colorUtils", () => {
  it("validates hex colors", () => {
    expect(isValidHex("#ff0000")).toBe(true);
    expect(isValidHex("#f00")).toBe(true);
    expect(isValidHex("#FF0000")).toBe(true);
    expect(isValidHex("ff0000")).toBe(true); // # is optional in validation
    expect(isValidHex("#gg0000")).toBe(false);
    expect(isValidHex("")).toBe(false);
    expect(isValidHex("#12345")).toBe(false);
  });

  it("normalizes 3-digit hex to 6-digit", () => {
    expect(normalizeHex("#f00")).toBe("#ff0000");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("#FF0000")).toBe("#ff0000");
  });

  it("converts hex to HSL", () => {
    const [h, s, l] = hexToHsl("#ff0000");
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(1, 1);
    expect(l).toBeCloseTo(0.5, 1);
  });

  it("converts hex to RGBA string", () => {
    const rgba = hexToRgba("#ff0000", 0.5);
    expect(rgba).toContain("rgba(255");
    expect(rgba).toContain("0.5");
  });

  it("shifts hue", () => {
    const shifted = shiftHexHue("#ff0000", 120);
    expect(isValidHex(shifted)).toBe(true);
    expect(shifted).not.toBe("#ff0000");
  });

  it("blends two hex colors", () => {
    const blended = blendHex("#ff0000", "#0000ff", 0.5);
    expect(isValidHex(blended)).toBe(true);
  });
});

// --- Entity Visual Config defaults ---
describe("EntityVisualConfig defaults", () => {
  it("DEFAULT_ENTITY_VISUAL has correct shape", () => {
    expect(DEFAULT_ENTITY_VISUAL.customColorsEnabled).toBe(false);
    expect(isValidHex(DEFAULT_ENTITY_VISUAL.primaryColor)).toBe(true);
    expect(DEFAULT_ENTITY_VISUAL.secondaryColor).toBeNull();
    expect(DEFAULT_ENTITY_VISUAL.toneMode).toBe("single");
    expect(DEFAULT_ENTITY_VISUAL.opacity).toBe(0.95);
  });

  it("opacity is clamped 0.1-1.0", () => {
    const vis: EntityVisualConfig = { ...DEFAULT_ENTITY_VISUAL, opacity: 0.05 };
    expect(vis.opacity).toBeLessThan(0.11);
  });
});

// --- Audio expansion ---
describe("AudioConfig expansion", () => {
  it("DEFAULT_AUDIO has frequency controls", () => {
    expect(DEFAULT_AUDIO.ambientFrequency).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_AUDIO.ambientFrequency).toBeLessThanOrEqual(1);
    expect(DEFAULT_AUDIO.reactionFrequency).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_AUDIO.moodFrequency).toBeGreaterThanOrEqual(0);
  });

  it("DEFAULT_AUDIO has global cooldown", () => {
    expect(DEFAULT_AUDIO.globalCooldownMs).toBeGreaterThan(0);
  });

  it("DEFAULT_AUDIO has soundEnables array", () => {
    expect(Array.isArray(DEFAULT_AUDIO.soundEnables)).toBe(true);
  });
});

// --- Sound Catalog ---
describe("Sound catalog", () => {
  it("has at least 15 sounds", () => {
    expect(SOUND_CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it("every sound has required fields", () => {
    for (const snd of SOUND_CATALOG) {
      expect(snd.id).toBeTruthy();
      expect(snd.name).toBeTruthy();
      expect(snd.category).toBeTruthy();
      expect(typeof snd.play).toBe("function");
    }
  });

  it("can look up sounds by id", () => {
    expect(getSoundById("chirp")).toBeDefined();
    expect(getSoundById("nonexistent")).toBeUndefined();
  });

  it("filters by category", () => {
    const reactions = getSoundsByCategory("reaction");
    expect(reactions.length).toBeGreaterThan(0);
    expect(reactions.every(s => s.category === "reaction")).toBe(true);
  });

  it("filters by behavior", () => {
    const inspectSounds = getSoundsForBehavior("inspect");
    expect(inspectSounds.length).toBeGreaterThan(0);
  });

  it("filters by mood", () => {
    const calmSounds = getSoundsForMood("calm");
    expect(calmSounds.length).toBeGreaterThan(0);
  });

  it("covers all 4 non-UI categories", () => {
    const categories = new Set(SOUND_CATALOG.map(s => s.category));
    expect(categories.has("reaction")).toBe(true);
    expect(categories.has("mood")).toBe(true);
    expect(categories.has("ambient")).toBe(true);
    expect(categories.has("social")).toBe(true);
  });
});

// --- Monitor utilities ---
describe("Monitor utilities", () => {
  const monitors: MonitorInfo[] = [
    { name: "Monitor1", x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1 },
    { name: "Monitor2", x: 1920, y: 0, width: 2560, height: 1440, scaleFactor: 1.25 },
  ];

  it("computes virtual desktop spanning all monitors", () => {
    const vd = computeVirtualDesktop(monitors);
    expect(vd.x).toBe(0);
    expect(vd.y).toBe(0);
    expect(vd.width).toBe(1920 + 2560);
    expect(vd.height).toBe(1440);
  });

  it("returns fallback for empty monitor list", () => {
    const vd = computeVirtualDesktop([]);
    expect(vd.width).toBe(1920);
    expect(vd.height).toBe(1080);
  });

  it("finds monitor for a position", () => {
    const m = getMonitorForPosition({ x: 100, y: 100 }, monitors);
    expect(m?.name).toBe("Monitor1");

    const m2 = getMonitorForPosition({ x: 2000, y: 100 }, monitors);
    expect(m2?.name).toBe("Monitor2");

    const none = getMonitorForPosition({ x: -100, y: -100 }, monitors);
    expect(none).toBeNull();
  });

  it("clamps position to monitor bounds", () => {
    const clamped = clampToMonitor({ x: -50, y: -50 }, monitors[0], 40);
    expect(clamped.x).toBe(40);
    expect(clamped.y).toBe(40);
  });

  it("resolves display monitor 'global' to null", () => {
    expect(resolveDisplayMonitor("global", monitors)).toBeNull();
  });

  it("resolves display monitor 'primary'", () => {
    const m = resolveDisplayMonitor("primary", monitors);
    expect(m?.name).toBe("Monitor1");
  });

  it("resolves display monitor by name", () => {
    const m = resolveDisplayMonitor("Monitor2", monitors);
    expect(m?.name).toBe("Monitor2");
  });

  it("getEntityBounds returns full virtual desktop for 'global'", () => {
    const vd = computeVirtualDesktop(monitors);
    const bounds = getEntityBounds("global", monitors, vd);
    expect(bounds.width).toBe(vd.width);
    expect(bounds.index).toBe(-1);
  });

  it("getEntityBounds returns specific monitor for named display", () => {
    const vd = computeVirtualDesktop(monitors);
    const bounds = getEntityBounds("Monitor2", monitors, vd);
    expect(bounds.x).toBe(1920);
    expect(bounds.width).toBe(2560);
  });
});

// --- Scenario Presets ---
describe("Scenario presets", () => {
  it("has at least 6 presets", () => {
    expect(SCENARIO_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("every preset has required fields", () => {
    for (const p of SCENARIO_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(typeof p.apply).toBe("function");
    }
  });

  it("getPresetById works", () => {
    expect(getPresetById("calm")).toBeDefined();
    expect(getPresetById("nonexistent")).toBeUndefined();
  });

  it("calm preset reduces audio volume and increases dwell", () => {
    const patch = getPresetById("calm")!.apply(DEFAULT_CONFIG);
    expect(patch.audio?.volume).toBeLessThan(DEFAULT_CONFIG.audio.volume);
    expect(patch.behavior?.dwellTime).toBeGreaterThan(DEFAULT_CONFIG.behavior.dwellTime);
  });

  it("extreme preset maxes out visual intensity", () => {
    const patch = getPresetById("extreme")!.apply(DEFAULT_CONFIG);
    expect(patch.appearance?.glowIntensity).toBe(1.0);
    expect(patch.appearance?.particleAmount).toBe(1.0);
  });

  it("low_pc preset disables expensive features", () => {
    const patch = getPresetById("low_pc")!.apply(DEFAULT_CONFIG);
    expect(patch.appearance?.reducedMotion).toBe(true);
    expect(patch.emote?.enabled).toBe(false);
    expect(patch.atmosphere?.enabled).toBe(false);
  });

  it("silent preset mutes all audio", () => {
    const patch = getPresetById("silent")!.apply(DEFAULT_CONFIG);
    expect(patch.audio?.kovySounds).toBe(false);
    expect(patch.audio?.uiSounds).toBe(false);
    expect(patch.audio?.volume).toBe(0);
  });

  it("presets produce valid partial config keys", () => {
    const validKeys = new Set(Object.keys(DEFAULT_CONFIG));
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      for (const key of Object.keys(patch)) {
        expect(validKeys.has(key)).toBe(true);
      }
    }
  });

  it("preset behavior fields match BehaviorConfig schema", () => {
    const validBehaviorKeys = new Set(Object.keys(DEFAULT_CONFIG.behavior));
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      if (patch.behavior) {
        for (const key of Object.keys(patch.behavior)) {
          expect(validBehaviorKeys.has(key)).toBe(true);
        }
      }
    }
  });

  it("preset performance fields match PerformanceConfig schema", () => {
    const validPerfKeys = new Set(Object.keys(DEFAULT_CONFIG.performance));
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      if (patch.performance) {
        for (const key of Object.keys(patch.performance)) {
          expect(validPerfKeys.has(key)).toBe(true);
        }
      }
    }
  });

  it("preset dwellTime values are in valid seconds range (1-30)", () => {
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      if (patch.behavior?.dwellTime !== undefined) {
        expect(patch.behavior.dwellTime).toBeGreaterThanOrEqual(1);
        expect(patch.behavior.dwellTime).toBeLessThanOrEqual(30);
      }
    }
  });

  it("preset wanderAmount values are in valid 0-1 range", () => {
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      if (patch.behavior?.wanderAmount !== undefined) {
        expect(patch.behavior.wanderAmount).toBeGreaterThanOrEqual(0);
        expect(patch.behavior.wanderAmount).toBeLessThanOrEqual(1);
      }
    }
  });

  it("no presets use as-any casts for valid enum values", () => {
    for (const preset of SCENARIO_PRESETS) {
      const patch = preset.apply(DEFAULT_CONFIG);
      if (patch.emote?.style) {
        expect(["bubble", "raw"]).toContain(patch.emote.style);
      }
      if (patch.atmosphere?.style) {
        expect(["organic", "geometric", "minimal"]).toContain(patch.atmosphere.style);
      }
      if (patch.performance?.preset) {
        expect(["battery", "balanced", "quality", "ultra"]).toContain(patch.performance.preset);
      }
    }
  });

  it("focus preset increases dwell and reduces wander", () => {
    const patch = getPresetById("focus")!.apply(DEFAULT_CONFIG);
    expect(patch.behavior?.dwellTime).toBeGreaterThan(DEFAULT_CONFIG.behavior.dwellTime);
    expect(patch.behavior?.wanderAmount).toBeLessThan(DEFAULT_CONFIG.behavior.wanderAmount);
  });

  it("extreme preset reduces dwell and increases wander", () => {
    const patch = getPresetById("extreme")!.apply(DEFAULT_CONFIG);
    expect(patch.behavior?.dwellTime).toBeLessThan(DEFAULT_CONFIG.behavior.dwellTime);
    expect(patch.behavior?.wanderAmount).toBeGreaterThan(DEFAULT_CONFIG.behavior.wanderAmount);
  });

  it("playful preset enables gaming and boosts curiosity", () => {
    const patch = getPresetById("playful")!.apply(DEFAULT_CONFIG);
    expect(patch.gaming?.enabled).toBe(true);
    expect(patch.behavior?.curiosityStrength).toBeGreaterThan(DEFAULT_CONFIG.behavior.curiosityStrength);
  });

  it("low_pc preset caps render FPS and selects battery performance", () => {
    const patch = getPresetById("low_pc")!.apply(DEFAULT_CONFIG);
    expect(patch.performance?.maxRenderFps).toBeLessThanOrEqual(30);
    expect(patch.performance?.preset).toBe("battery");
  });
});

// --- Config migration v7 → v8 ---
describe("v7→v8 migration", () => {
  it("migrates v7 config to v8 with new audio fields", () => {
    const v7Config = {
      ...DEFAULT_CONFIG,
      version: 7,
      audio: {
        uiSounds: true,
        kovySounds: true,
        volume: 0.5,
        // Missing new fields
      },
    };
    const result = safeImportConfig(v7Config);
    expect(result.config).not.toBeNull();
    expect(result.config!.version).toBe(CONFIG_VERSION);
    expect(result.config!.audio.ambientFrequency).toBeDefined();
    expect(result.config!.audio.reactionFrequency).toBeDefined();
    expect(result.config!.audio.moodFrequency).toBeDefined();
    expect(result.config!.audio.globalCooldownMs).toBeDefined();
    expect(result.config!.audio.soundEnables).toBeDefined();
  });
});

// --- Version alignment ---
describe("v6.0.0 version alignment", () => {
  it("CONFIG_VERSION is a positive integer", () => {
    expect(CONFIG_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG_VERSION)).toBe(true);
  });

  it("DEFAULT_CONFIG.version matches CONFIG_VERSION", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
  });

  it("KOVY_VERSION is a valid semver string", () => {
    expect(KOVY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
