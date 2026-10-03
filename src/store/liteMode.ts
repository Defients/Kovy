// ============================================================
// Lite Mode — feature mask and config transformation
//
// Defines which config sections are constrained in Lite mode
// and provides functions to apply/remove the Lite mask.
// ============================================================

import type { KovyConfig } from "./types";

export const LITE_DISABLED_SECTIONS = [
  "family",
  "muse",
  "gaming",
  "habitat",
  "habitatObjects",
  "appProfile",
  "circadian",
  "atmosphere",
  "memory",
  "vision",
  "familyScenes",
  "entityRelations",
  "audioReactivity",
  "personalityEvolution",
  "seasonal",
  "growth",
  "drag",
  "ambientSound",
  "whisper",
  "thought",
  "dream",
  "toys",
  "experimental",
] as const;

export type LiteDisabledSection = (typeof LITE_DISABLED_SECTIONS)[number];

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Capture the current values of Lite-disabled sections into a shadow config
 * so they can be restored when switching back to Full mode.
 */
export function captureShadowConfig(config: KovyConfig): Partial<KovyConfig> {
  const shadow: Record<string, unknown> = {};
  for (const section of LITE_DISABLED_SECTIONS) {
    shadow[section] = deepClone(config[section as keyof KovyConfig]);
  }
  return shadow as Partial<KovyConfig>;
}

/**
 * Apply Lite mode constraints to a config.
 * Disables advanced sections while preserving user's core preferences
 * (behavior, appearance, audio, bond, milestones, rituals, stats).
 */
export function applyLiteMask(config: KovyConfig): KovyConfig {
  const result = deepClone(config);

  // Disable advanced sections
  result.family = { ...result.family, maxEntities: 1 };
  result.muse = { ...result.muse, enabled: false };
  result.gaming = { ...result.gaming, enabled: false };
  result.habitat = { ...result.habitat, enabled: false };
  result.habitatObjects = { ...result.habitatObjects, enabled: false };
  result.appProfile = { ...result.appProfile, enabled: false };
  result.circadian = { ...result.circadian, enabled: true, dreamEnabled: false, startleEnabled: false };
  result.atmosphere = { ...result.atmosphere, enabled: false };
  result.memory = { ...result.memory, enabled: false };
  result.vision = {
    ...result.vision,
    enabled: true,
    analysisFps: 3,
    ocrEnabled: false,
  };
  result.familyScenes = { ...result.familyScenes, enabled: false };
  result.entityRelations = { ...result.entityRelations, enabled: false };
  result.audioReactivity = { ...result.audioReactivity, enabled: false };
  result.personalityEvolution = { ...result.personalityEvolution, enabled: false };
  result.seasonal = { ...result.seasonal, enabled: false };
  result.growth = { ...result.growth, enabled: false };
  result.drag = { ...result.drag, enabled: false };
  result.ambientSound = { ...result.ambientSound, enabled: false };
  result.whisper = { ...result.whisper, enabled: false };
  result.thought = { ...result.thought, enabled: false };

  // Simplify performance for Lite
  result.performance = {
    ...result.performance,
    preset: "balanced",
    maxRenderFps: 60,
    backgroundThrottling: true,
    adaptiveQuality: true,
  };

  // Keep core features active but simplified
  result.emote = { ...result.emote, maxActive: Math.min(result.emote.maxActive, 5) };
  result.mood = { ...result.mood, randomDrift: Math.min(result.mood.randomDrift, 0.3) };

  result.general = { ...result.general, experienceMode: "lite" };
  return result;
}

/**
 * Remove Lite mode constraints by restoring shadow config values.
 * Falls back to current config values if shadow is null (first time switching).
 */
export function removeLiteMask(config: KovyConfig, shadow: Partial<KovyConfig> | null): KovyConfig {
  const result = deepClone(config);

  if (shadow) {
    for (const section of LITE_DISABLED_SECTIONS) {
      const shadowValue = shadow[section as keyof KovyConfig];
      if (shadowValue !== undefined) {
        (result as unknown as Record<string, unknown>)[section] = deepClone(shadowValue);
      }
    }
  }

  result.general = { ...result.general, experienceMode: "full" };
  return result;
}

/**
 * Check if a config section is visible in Lite mode.
 */
export function isSectionVisibleInLite(section: string): boolean {
  return !LITE_DISABLED_SECTIONS.includes(section as LiteDisabledSection);
}
