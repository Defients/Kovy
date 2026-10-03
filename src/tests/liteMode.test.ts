import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "@/store/defaults";
import type { KovyConfig } from "@/store/types";
import {
  applyLiteMask,
  removeLiteMask,
  captureShadowConfig,
  LITE_DISABLED_SECTIONS,
  isSectionVisibleInLite,
} from "@/store/liteMode";
import { LITE_PRESETS, getLitePresetById } from "@/store/litePresets";

function makeTestConfig(): KovyConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

describe("Lite Mode — applyLiteMask", () => {
  it("sets experienceMode to lite", () => {
    const config = makeTestConfig();
    config.general.experienceMode = "full";
    const result = applyLiteMask(config);
    expect(result.general.experienceMode).toBe("lite");
  });

  it("disables advanced sections", () => {
    const config = makeTestConfig();
    config.muse.enabled = true;
    config.gaming.enabled = true;
    config.habitat.enabled = true;
    const result = applyLiteMask(config);
    expect(result.muse.enabled).toBe(false);
    expect(result.gaming.enabled).toBe(false);
    expect(result.habitat.enabled).toBe(false);
  });

  it("disables memory and vision OCR", () => {
    const config = makeTestConfig();
    config.memory.enabled = true;
    config.vision.ocrEnabled = true;
    const result = applyLiteMask(config);
    expect(result.memory.enabled).toBe(false);
    expect(result.vision.ocrEnabled).toBe(false);
  });

  it("preserves core features (behavior, appearance, audio, bond)", () => {
    const config = makeTestConfig();
    config.behavior.preset = "goblin";
    config.appearance.size = 1.5;
    config.audio.volume = 0.7;
    config.bond.enabled = true;
    const result = applyLiteMask(config);
    expect(result.behavior.preset).toBe("goblin");
    expect(result.appearance.size).toBe(1.5);
    expect(result.audio.volume).toBe(0.7);
    expect(result.bond.enabled).toBe(true);
  });

  it("constrains emote maxActive", () => {
    const config = makeTestConfig();
    config.emote.maxActive = 20;
    const result = applyLiteMask(config);
    expect(result.emote.maxActive).toBeLessThanOrEqual(5);
  });

  it("sets family maxEntities to 1", () => {
    const config = makeTestConfig();
    config.family.maxEntities = 5;
    const result = applyLiteMask(config);
    expect(result.family.maxEntities).toBe(1);
  });
});

describe("Lite Mode — captureShadowConfig", () => {
  it("captures all disabled sections", () => {
    const config = makeTestConfig();
    config.muse.enabled = true;
    config.gaming.enabled = true;
    const shadow = captureShadowConfig(config);
    for (const section of LITE_DISABLED_SECTIONS) {
      expect(shadow[section as keyof KovyConfig]).toBeDefined();
    }
    expect((shadow.muse as any).enabled).toBe(true);
    expect((shadow.gaming as any).enabled).toBe(true);
  });
});

describe("Lite Mode — removeLiteMask", () => {
  it("sets experienceMode to full", () => {
    const config = makeTestConfig();
    const result = removeLiteMask(config, null);
    expect(result.general.experienceMode).toBe("full");
  });

  it("restores shadow config values", () => {
    const config = makeTestConfig();
    config.muse.enabled = false; // Lite mode disabled it
    config.gaming.enabled = false;
    const shadow = captureShadowConfig({
      ...config,
      muse: { ...config.muse, enabled: true },
      gaming: { ...config.gaming, enabled: true },
    });
    const result = removeLiteMask(config, shadow);
    expect(result.muse.enabled).toBe(true);
    expect(result.gaming.enabled).toBe(true);
  });

  it("works with null shadow (first time switch)", () => {
    const config = makeTestConfig();
    const result = removeLiteMask(config, null);
    expect(result.general.experienceMode).toBe("full");
  });
});

describe("Lite Mode — isSectionVisibleInLite", () => {
  it("returns false for disabled sections", () => {
    expect(isSectionVisibleInLite("family")).toBe(false);
    expect(isSectionVisibleInLite("muse")).toBe(false);
    expect(isSectionVisibleInLite("gaming")).toBe(false);
    expect(isSectionVisibleInLite("habitat")).toBe(false);
  });

  it("returns true for core sections", () => {
    expect(isSectionVisibleInLite("behavior")).toBe(true);
    expect(isSectionVisibleInLite("appearance")).toBe(true);
    expect(isSectionVisibleInLite("audio")).toBe(true);
    expect(isSectionVisibleInLite("bond")).toBe(true);
  });
});

describe("Lite Presets", () => {
  it("has 8 presets", () => {
    expect(LITE_PRESETS).toHaveLength(8);
  });

  it("has 4 new and 4 existing presets", () => {
    const newPresets = LITE_PRESETS.filter(p => p.category === "new");
    const existingPresets = LITE_PRESETS.filter(p => p.category === "existing");
    expect(newPresets).toHaveLength(4);
    expect(existingPresets).toHaveLength(4);
  });

  it("each preset has required fields", () => {
    for (const preset of LITE_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(typeof preset.apply).toBe("function");
    }
  });

  it("getLitePresetById returns correct preset", () => {
    const preset = getLitePresetById("companion");
    expect(preset).toBeDefined();
    expect(preset!.name).toBe("Companion");
  });

  it("getLitePresetById returns undefined for unknown id", () => {
    const preset = getLitePresetById("nonexistent");
    expect(preset).toBeUndefined();
  });

  it("companion preset applies behavior changes", () => {
    const config = makeTestConfig();
    const preset = getLitePresetById("companion")!;
    const patches = preset.apply(config);
    expect(patches.behavior).toBeDefined();
    expect((patches.behavior as any).preset).toBe("curious");
  });

  it("work_buddy preset applies focus behavior", () => {
    const config = makeTestConfig();
    const preset = getLitePresetById("work_buddy")!;
    const patches = preset.apply(config);
    expect((patches.behavior as any).preset).toBe("focus");
  });

  it("party_mode preset applies high energy settings", () => {
    const config = makeTestConfig();
    const preset = getLitePresetById("party_mode")!;
    const patches = preset.apply(config);
    expect((patches.behavior as any).wanderAmount).toBeGreaterThan(0.5);
    expect((patches.emote as any).intensity).toBeGreaterThan(0.5);
  });

  it("existing presets delegate to scenario presets", () => {
    const config = makeTestConfig();
    const preset = getLitePresetById("calm")!;
    const patches = preset.apply(config);
    expect(patches).toBeDefined();
    expect(Object.keys(patches).length).toBeGreaterThan(0);
  });
});
