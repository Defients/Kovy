// ============================================================
// Config validation, deep merge, and schema migration
// ============================================================

import type { KovyConfig } from "./types";
import { CONFIG_VERSION } from "./types";
import { DEFAULT_CONFIG } from "./defaults";
import { runMigrations } from "./migrationRegistry";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  migrated: boolean;
}

/** Deep merge source into target, preserving target keys that source doesn't have */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (sourceVal === undefined) continue;

    if (
      targetVal !== null &&
      sourceVal !== null &&
      typeof targetVal === "object" &&
      typeof sourceVal === "object" &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

/** Validate a config object against expected types and ranges */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  let migrated = false;

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: ["Config is not an object"], migrated: false };
  }

  const obj = raw as Record<string, unknown>;

  // Check version
  if (typeof obj.version !== "number") {
    errors.push("Missing or invalid version field");
    return { valid: false, errors, migrated: false };
  }

  // Version migration — delegates to the migration registry
  if (obj.version < CONFIG_VERSION) {
    migrated = runMigrations(obj, obj.version);
  }

  if (obj.version > CONFIG_VERSION) {
    errors.push(`Config version ${obj.version} is newer than supported ${CONFIG_VERSION}`);
    return { valid: false, errors, migrated: false };
  }

  // Validate each section exists and is an object
  const sections = [
    "general", "appearance", "behavior", "vision", "mood",
    "performance", "privacy", "audio", "hotkeys", "advanced", "habitat",
    "memory", "family", "muse", "gaming", "circadian", "emote", "atmosphere", "bond", "milestone",
    "ritual", "journal", "weather", "skinPack", "soundPack", "familyScenes", "appProfile", "habitatObjects",
    "audioReactivity", "thought", "seasonal", "growth", "stats", "focus", "idle",
    "personalityEvolution", "celebration", "ambientSound", "whisper", "entityRelations", "drag", "profiles",
    "dream",
    "focusTarget",
    "ai",
    "toys",
    "experimental",
    "intent",
    "story",
    "recall",
    "chat",
  ];

  for (const section of sections) {
    if (typeof obj[section] !== "object" || obj[section] === null) {
      errors.push(`Missing or invalid section: ${section}`);
    }
  }

  // Validate specific ranges for critical numeric values
  if (typeof obj.appearance === "object" && obj.appearance !== null) {
    const app = obj.appearance as Record<string, unknown>;
    if (typeof app.size === "number") {
      if (app.size < 0.3 || app.size > 3.0) errors.push("appearance.size out of range [0.3, 3.0]");
    }
    if (typeof app.opacity === "number") {
      if (app.opacity < 0.1 || app.opacity > 1.0) errors.push("appearance.opacity out of range [0.1, 1.0]");
    }
  }

  if (typeof obj.vision === "object" && obj.vision !== null) {
    const vis = obj.vision as Record<string, unknown>;
    if (typeof vis.analysisFps === "number") {
      if (vis.analysisFps < 1 || vis.analysisFps > 15) errors.push("vision.analysisFps out of range [1, 15]");
    }
    if (typeof vis.motionThreshold === "number") {
      if (vis.motionThreshold < 5 || vis.motionThreshold > 80) errors.push("vision.motionThreshold out of range [5, 80]");
    }
  }

  // Validate hotkey strings
  if (typeof obj.hotkeys === "object" && obj.hotkeys !== null) {
    const hk = obj.hotkeys as Record<string, unknown>;
    for (const [key, val] of Object.entries(hk)) {
      if (typeof val !== "string") {
        errors.push(`hotkeys.${key} must be a string`);
      }
    }
  }

  return { valid: errors.length === 0, errors, migrated };
}

/** Clamp numeric config values to their valid ranges */
export function clampConfig(config: KovyConfig): KovyConfig {
  const c = { ...config };

  // Appearance
  c.appearance = { ...c.appearance };
  c.appearance.size = clamp(c.appearance.size, 0.3, 3.0);
  c.appearance.opacity = clamp(c.appearance.opacity, 0.1, 1.0);
  c.appearance.glowIntensity = clamp(c.appearance.glowIntensity, 0, 1);
  c.appearance.particleAmount = clamp(c.appearance.particleAmount, 0, 1);
  c.appearance.trailLength = clamp(c.appearance.trailLength, 0, 1);
  c.appearance.shadowSoftness = clamp(c.appearance.shadowSoftness, 0, 1);
  c.appearance.emoteIntensity = clamp(c.appearance.emoteIntensity, 0, 1);
  c.appearance.renderFpsCap = clampToSet(c.appearance.renderFpsCap, [15, 30, 60, 120]);
  if (!["classic", "blob", "ghost", "star", "crystal"].includes(c.appearance.bodyStyle)) c.appearance.bodyStyle = "classic";
  if (!["round", "soft", "narrow", "dot", "sparkle", "heart", "crescent"].includes(c.appearance.eyeStyle)) c.appearance.eyeStyle = "round";
  if (typeof c.appearance.accessoriesEnabled !== "boolean") c.appearance.accessoriesEnabled = true;
  if (typeof c.appearance.auroraBackground !== "boolean") c.appearance.auroraBackground = true;
  if (typeof c.appearance.particleBursts !== "boolean") c.appearance.particleBursts = true;

  // Vision
  c.vision = { ...c.vision };
  c.vision.analysisFps = clamp(c.vision.analysisFps, 1, 15);
  c.vision.analysisScale = clamp(c.vision.analysisScale, 0.05, 0.5);
  c.vision.motionThreshold = clamp(c.vision.motionThreshold, 5, 80);
  c.vision.persistenceThreshold = clamp(c.vision.persistenceThreshold, 1, 10);
  c.vision.targetSmoothing = clamp(c.vision.targetSmoothing, 0, 1);
  c.vision.noveltyWeight = clamp(c.vision.noveltyWeight, 0, 1);
  c.vision.cursorAdjacentWeight = clamp(c.vision.cursorAdjacentWeight, 0, 1);

  // Behavior
  c.behavior = { ...c.behavior };
  c.behavior.curiosityStrength = clamp(c.behavior.curiosityStrength, 0, 1);
  c.behavior.attractionStrength = clamp(c.behavior.attractionStrength, 0, 1);
  c.behavior.boredomRate = clamp(c.behavior.boredomRate, 0, 1);
  c.behavior.dwellTime = clamp(c.behavior.dwellTime, 1, 30);
  c.behavior.cursorAvoidRadius = clamp(c.behavior.cursorAvoidRadius, 0, 400);

  // Hyper
  if (c.behavior.hyper) {
    c.behavior.hyper = { ...c.behavior.hyper };
    c.behavior.hyper.dashStrength = clamp(c.behavior.hyper.dashStrength, 0, 1);
    c.behavior.hyper.chainDelay = clamp(c.behavior.hyper.chainDelay, 0.1, 2);
    c.behavior.hyper.orbitBurstDuration = clamp(c.behavior.hyper.orbitBurstDuration, 0.3, 3);
    c.behavior.hyper.targetChainThreshold = clamp(c.behavior.hyper.targetChainThreshold, 0, 1);
    c.behavior.hyper.maxChainRate = clamp(c.behavior.hyper.maxChainRate, 1, 10);
    c.behavior.hyper.dashCooldown = clamp(c.behavior.hyper.dashCooldown, 0.2, 3);
  }

  // Mood
  c.mood = { ...c.mood };
  c.mood.intensity = clamp(c.mood.intensity, 0, 1);
  c.mood.recoverySpeed = clamp(c.mood.recoverySpeed, 0, 1);
  c.mood.overwhelmThreshold = clamp(c.mood.overwhelmThreshold, 0.2, 1);
  c.mood.energyBaseline = clamp(c.mood.energyBaseline, 0, 1);
  c.mood.sleepinessBaseline = clamp(c.mood.sleepinessBaseline, 0, 1);
  c.mood.playfulnessBias = clamp(c.mood.playfulnessBias, -1, 1);
  c.mood.shynessBias = clamp(c.mood.shynessBias, -1, 1);
  c.mood.focusBias = clamp(c.mood.focusBias, -1, 1);
  c.mood.randomDrift = clamp(c.mood.randomDrift, 0, 1);

  // Performance
  c.performance = { ...c.performance };
  c.performance.cpuBudget = clamp(c.performance.cpuBudget, 1, 20);
  c.performance.maxAnalysisFps = clamp(c.performance.maxAnalysisFps, 1, 15);
  c.performance.maxRenderFps = clamp(c.performance.maxRenderFps, 15, 120);

  // In browser/overlay contexts, clamp to actual monitor refresh rate if possible
  // We do this safely without breaking Node/SSR contexts
  if (typeof window !== "undefined" && window.screen) {
    // Note: This is a best-effort heuristic. If we can't detect, we leave it.
    // Modern browsers don't reliably expose refresh rate, so we rely on the 120 cap above.
    // However, if we know it's a 60Hz screen, we shouldn't burn CPU trying to hit 120.
    // We leave this as a future enhancement hook for Tauri to provide exact monitor Hz.
  }

  // Vision — new OCR fields
  c.vision.ocrCooldownMs = clamp(c.vision.ocrCooldownMs ?? 5000, 2000, 30000);
  c.vision.ocrMaxRegions = clamp(c.vision.ocrMaxRegions ?? 1, 1, 3);

  // Audio
  c.audio = { ...c.audio };
  c.audio.volume = clamp(c.audio.volume, 0, 1);
  c.audio.ambientFrequency = clamp(c.audio.ambientFrequency ?? 0.3, 0, 1);
  c.audio.reactionFrequency = clamp(c.audio.reactionFrequency ?? 0.6, 0, 1);
  c.audio.moodFrequency = clamp(c.audio.moodFrequency ?? 0.4, 0, 1);
  c.audio.globalCooldownMs = clamp(c.audio.globalCooldownMs ?? 1500, 500, 5000);
  if (!Array.isArray(c.audio.soundEnables)) c.audio.soundEnables = [];

  // Memory
  c.memory = { ...c.memory };
  c.memory.maxMemories = clamp(c.memory.maxMemories ?? 2000, 500, 5000);
  c.memory.retentionDays = clamp(c.memory.retentionDays ?? 90, 7, 365);
  c.memory.significanceThreshold = clamp(c.memory.significanceThreshold ?? 0.3, 0, 1);
  c.memory.autoExportSoulDays = clamp(c.memory.autoExportSoulDays ?? 0, 0, 365);

  // Family
  c.family = { ...c.family };
  c.family.maxEntities = clamp(c.family.maxEntities ?? 1, 1, 11);
  c.family.familyUpdateIntervalMs = clamp(c.family.familyUpdateIntervalMs ?? 500, 200, 2000);
  if (c.family.dynamics) {
    c.family.dynamics = { ...c.family.dynamics };
    c.family.dynamics.curiosityContagion = clamp(c.family.dynamics.curiosityContagion, 0, 1);
    c.family.dynamics.comfortInfluence = clamp(c.family.dynamics.comfortInfluence, 0, 1);
    c.family.dynamics.playfulChaseChance = clamp(c.family.dynamics.playfulChaseChance, 0, 1);
    c.family.dynamics.territoryRespect = clamp(c.family.dynamics.territoryRespect, 0, 1);
  }

  // Muse
  c.muse = { ...c.muse };
  c.muse.maxOverlays = clamp(c.muse.maxOverlays ?? 6, 1, 12);
  c.muse.overlayLifetime = clamp(c.muse.overlayLifetime ?? 5, 2, 8);
  c.muse.contextUpdateIntervalMs = clamp(c.muse.contextUpdateIntervalMs ?? 3000, 1000, 10000);

  // Gaming
  c.gaming = { ...c.gaming };
  c.gaming.predictiveBias = clamp(c.gaming.predictiveBias ?? 0.5, 0, 1);
  c.gaming.excitementGain = clamp(c.gaming.excitementGain ?? 0.5, 0, 1);
  c.gaming.hyperBlend = clamp(c.gaming.hyperBlend ?? 0.4, 0, 1);
  c.gaming.residueAmount = clamp(c.gaming.residueAmount ?? 0.5, 0, 1);
  c.gaming.residueLifetime = clamp(c.gaming.residueLifetime ?? 0.6, 0.08, 1.2);
  c.gaming.elasticDeformation = clamp(c.gaming.elasticDeformation ?? 0.5, 0, 1);
  c.gaming.freeformWobble = clamp(c.gaming.freeformWobble ?? 0.3, 0, 1);

  // Circadian
  c.circadian = { ...c.circadian };
  c.circadian.adaptationRate = clamp(c.circadian.adaptationRate ?? 0.3, 0, 1);
  c.circadian.amplifyDayNight = clamp(c.circadian.amplifyDayNight ?? 0.5, 0, 1);
  c.circadian.startleCooldown = clamp(c.circadian.startleCooldown ?? 8, 1, 30);

  // Emote
  c.emote = { ...c.emote };
  c.emote.intensity = clamp(c.emote.intensity ?? 0.6, 0, 1);
  c.emote.maxActive = clamp(c.emote.maxActive ?? 6, 3, 12);

  // Atmosphere
  c.atmosphere = { ...c.atmosphere };
  c.atmosphere.density = clamp(c.atmosphere.density ?? 0.4, 0, 1);

  // Bond
  c.bond = { ...c.bond };
  c.bond.bondDecayPerDay = clamp(c.bond.bondDecayPerDay ?? 0.02, 0, 0.05);
  c.bond.interactionRadius = clamp(c.bond.interactionRadius ?? 80, 30, 150);
  c.bond.pokeStartleChance = clamp(c.bond.pokeStartleChance ?? 0.3, 0, 1);

  // Milestone — no numeric ranges, just ensure booleans
  c.milestone = { ...c.milestone };
  if (typeof c.milestone.enabled !== "boolean") c.milestone.enabled = true;
  if (typeof c.milestone.showNotifications !== "boolean") c.milestone.showNotifications = true;
  if (typeof c.milestone.showProgressInTray !== "boolean") c.milestone.showProgressInTray = false;

  // Ritual
  c.ritual = { ...c.ritual };
  if (typeof c.ritual.enabled !== "boolean") c.ritual.enabled = true;
  if (typeof c.ritual.notifyOnRitual !== "boolean") c.ritual.notifyOnRitual = true;

  // Journal
  c.journal = { ...c.journal };
  if (typeof c.journal.enabled !== "boolean") c.journal.enabled = true;
  c.journal.maxEntries = clamp(c.journal.maxEntries ?? 1000, 100, 2000);
  if (typeof c.journal.generateDailySummary !== "boolean") c.journal.generateDailySummary = true;

  // Weather
  c.weather = { ...c.weather };
  if (typeof c.weather.enabled !== "boolean") c.weather.enabled = true;
  c.weather.changeInterval = clamp(c.weather.changeInterval ?? 600, 120, 3600);
  c.weather.intensity = clamp(c.weather.intensity ?? 0.5, 0, 1);
  if (!Array.isArray(c.weather.allowedTypes)) c.weather.allowedTypes = ["clear"];

  // Skin Pack
  c.skinPack = { ...c.skinPack };
  if (typeof c.skinPack.activePackId !== "string") c.skinPack.activePackId = "default";
  if (!Array.isArray(c.skinPack.customPacks)) c.skinPack.customPacks = [];

  // Sound Pack
  c.soundPack = { ...c.soundPack };
  if (typeof c.soundPack.activePackId !== "string") c.soundPack.activePackId = "default";
  if (!Array.isArray(c.soundPack.customPacks)) c.soundPack.customPacks = [];

  // Family Scenes
  c.familyScenes = { ...c.familyScenes };
  if (typeof c.familyScenes.enabled !== "boolean") c.familyScenes.enabled = true;
  c.familyScenes.cooldownMultiplier = clamp(c.familyScenes.cooldownMultiplier ?? 1.0, 0.5, 3.0);
  c.familyScenes.proximityThreshold = clamp(c.familyScenes.proximityThreshold ?? 400, 100, 800);

  // App Profile
  c.appProfile = { ...c.appProfile };
  if (typeof c.appProfile.enabled !== "boolean") c.appProfile.enabled = false;
  if (typeof c.appProfile.autoDetect !== "boolean") c.appProfile.autoDetect = true;
  if (!Array.isArray(c.appProfile.profiles)) c.appProfile.profiles = [];

  // Habitat Objects
  c.habitatObjects = { ...c.habitatObjects };
  if (typeof c.habitatObjects.enabled !== "boolean") c.habitatObjects.enabled = true;
  c.habitatObjects.maxObjects = clamp(c.habitatObjects.maxObjects ?? 20, 0, 50);
  if (!Array.isArray(c.habitatObjects.objects)) c.habitatObjects.objects = [];

  // v12 new fields on existing sections
  if (typeof c.mood.moodColorTransitionSpeed === "number") c.mood.moodColorTransitionSpeed = clamp(c.mood.moodColorTransitionSpeed, 0, 1);
  if (typeof c.performance.adaptiveQuality !== "boolean") c.performance.adaptiveQuality = false;
  if (typeof c.bond.bondMilestoneVfx !== "boolean") c.bond.bondMilestoneVfx = true;
  if (typeof c.bond.rightClickMenu !== "boolean") c.bond.rightClickMenu = true;
  if (c.bond.doubleClickAction !== "celebrate" && c.bond.doubleClickAction !== "settings" && c.bond.doubleClickAction !== "none") c.bond.doubleClickAction = "celebrate";
  if (typeof c.gaming.comboSystem !== "boolean") c.gaming.comboSystem = true;
  if (typeof c.gaming.comboDecayRate === "number") c.gaming.comboDecayRate = clamp(c.gaming.comboDecayRate, 0.1, 2.0);
  if (typeof c.circadian.customSchedule !== "boolean") c.circadian.customSchedule = false;
  if (typeof c.circadian.dayStartTime === "number") c.circadian.dayStartTime = clamp(c.circadian.dayStartTime, 0, 23);
  if (typeof c.circadian.nightStartTime === "number") c.circadian.nightStartTime = clamp(c.circadian.nightStartTime, 0, 23);
  if (typeof c.circadian.sleepTracking !== "boolean") c.circadian.sleepTracking = false;
  if (typeof c.atmosphere.seasonalSync !== "boolean") c.atmosphere.seasonalSync = true;
  if (typeof c.weather.realWeatherSync !== "boolean") c.weather.realWeatherSync = false;
  if (typeof c.weather.realWeatherInterval === "number") c.weather.realWeatherInterval = clamp(c.weather.realWeatherInterval, 300, 7200);
  if (typeof c.weather.realWeatherLocation !== "string") c.weather.realWeatherLocation = "";
  if (typeof c.skinPack.circadianAutoSwitch !== "boolean") c.skinPack.circadianAutoSwitch = false;
  if (typeof c.ritual.coffeeBreak !== "boolean") c.ritual.coffeeBreak = true;
  if (typeof c.ritual.sunsetReflection !== "boolean") c.ritual.sunsetReflection = true;
  if (typeof c.ritual.lateNightSnack !== "boolean") c.ritual.lateNightSnack = true;
  if (typeof c.ritual.firstSnow !== "boolean") c.ritual.firstSnow = true;
  if (typeof c.ritual.morningGreetingTime === "number") c.ritual.morningGreetingTime = clamp(c.ritual.morningGreetingTime, 0, 23);
  if (typeof c.ritual.lunchTime === "number") c.ritual.lunchTime = clamp(c.ritual.lunchTime, 0, 23);
  if (typeof c.ritual.afternoonStretchTime === "number") c.ritual.afternoonStretchTime = clamp(c.ritual.afternoonStretchTime, 0, 23);
  if (typeof c.ritual.eveningWinddownTime === "number") c.ritual.eveningWinddownTime = clamp(c.ritual.eveningWinddownTime, 0, 23);
  if (c.family.dynamics) {
    if (typeof c.family.dynamics.interEntityBonds !== "boolean") c.family.dynamics.interEntityBonds = true;
    if (typeof c.family.dynamics.groupEmotes !== "boolean") c.family.dynamics.groupEmotes = true;
  }
  if (typeof c.muse.adaptiveSelection !== "boolean") c.muse.adaptiveSelection = true;

  // Audio Reactivity
  c.audioReactivity = { ...c.audioReactivity };
  if (typeof c.audioReactivity.enabled !== "boolean") c.audioReactivity.enabled = false;
  c.audioReactivity.sensitivity = clamp(c.audioReactivity.sensitivity ?? 0.5, 0, 1);
  if (typeof c.audioReactivity.beatDetection !== "boolean") c.audioReactivity.beatDetection = true;
  if (typeof c.audioReactivity.feedMood !== "boolean") c.audioReactivity.feedMood = true;
  if (typeof c.audioReactivity.feedGaming !== "boolean") c.audioReactivity.feedGaming = false;
  if (typeof c.audioReactivity.feedVisualizer !== "boolean") c.audioReactivity.feedVisualizer = true;
  if (!["bars","wave","pulse","none"].includes(c.audioReactivity.visualizerStyle)) c.audioReactivity.visualizerStyle = "bars";

  // Thought
  c.thought = { ...c.thought };
  if (typeof c.thought.enabled !== "boolean") c.thought.enabled = true;
  c.thought.frequency = clamp(c.thought.frequency ?? 0.3, 0, 1);
  c.thought.maxActive = clamp(c.thought.maxActive ?? 2, 1, 5);
  if (!["cloud","minimal","comic"].includes(c.thought.style)) c.thought.style = "cloud";
  if (!Array.isArray(c.thought.customThoughts)) c.thought.customThoughts = [];

  // Seasonal
  c.seasonal = { ...c.seasonal };
  if (typeof c.seasonal.enabled !== "boolean") c.seasonal.enabled = true;
  if (!Array.isArray(c.seasonal.events)) c.seasonal.events = [];
  if (!Array.isArray(c.seasonal.customEvents)) c.seasonal.customEvents = [];
  if (c.seasonal.hemisphere !== "northern" && c.seasonal.hemisphere !== "southern") c.seasonal.hemisphere = "northern";

  // Growth
  c.growth = { ...c.growth };
  if (typeof c.growth.enabled !== "boolean") c.growth.enabled = true;
  c.growth.agingRate = clamp(c.growth.agingRate ?? 1.0, 0.5, 2.0);
  if (!c.growth.stageThresholds) c.growth.stageThresholds = { young: 3, mature: 14, elder: 60 };
  c.growth.stageThresholds.young = clamp(c.growth.stageThresholds.young ?? 3, 1, 30);
  c.growth.stageThresholds.mature = clamp(c.growth.stageThresholds.mature ?? 14, 7, 90);
  c.growth.stageThresholds.elder = clamp(c.growth.stageThresholds.elder ?? 60, 30, 365);

  // Stats
  c.stats = { ...c.stats };
  if (typeof c.stats.enabled !== "boolean") c.stats.enabled = true;
  if (!["minimal","standard","detailed"].includes(c.stats.trackingLevel)) c.stats.trackingLevel = "standard";

  // Focus
  c.focus = { ...c.focus };
  if (typeof c.focus.enabled !== "boolean") c.focus.enabled = true;
  c.focus.detectionSensitivity = clamp(c.focus.detectionSensitivity ?? 0.5, 0, 1);
  if (typeof c.focus.focusBehavior !== "string") c.focus.focusBehavior = "meditate";
  if (typeof c.focus.suppressEmotes !== "boolean") c.focus.suppressEmotes = true;
  if (typeof c.focus.suppressSound !== "boolean") c.focus.suppressSound = true;

  // Idle
  c.idle = { ...c.idle };
  if (typeof c.idle.enabled !== "boolean") c.idle.enabled = true;
  c.idle.idleThresholdSec = clamp(c.idle.idleThresholdSec ?? 120, 30, 600);
  if (!Array.isArray(c.idle.idleBehaviors)) c.idle.idleBehaviors = ["explore","play_alone","nap","dream"];

  // Personality Evolution
  c.personalityEvolution = { ...c.personalityEvolution };
  if (typeof c.personalityEvolution.enabled !== "boolean") c.personalityEvolution.enabled = true;
  c.personalityEvolution.evolutionRate = clamp(c.personalityEvolution.evolutionRate ?? 0.3, 0, 1);

  // Celebration
  c.celebration = { ...c.celebration };
  if (typeof c.celebration.enabled !== "boolean") c.celebration.enabled = true;
  c.celebration.focusThreshold = clamp(c.celebration.focusThreshold ?? 25, 5, 120);
  c.celebration.returnThreshold = clamp(c.celebration.returnThreshold ?? 24, 1, 168);
  if (typeof c.celebration.weekendCelebration !== "boolean") c.celebration.weekendCelebration = true;

  // Ambient Sound
  c.ambientSound = { ...c.ambientSound };
  if (typeof c.ambientSound.enabled !== "boolean") c.ambientSound.enabled = false;
  c.ambientSound.volume = clamp(c.ambientSound.volume ?? 0.3, 0, 1);
  if (typeof c.ambientSound.syncWithWeather !== "boolean") c.ambientSound.syncWithWeather = true;
  if (!Array.isArray(c.ambientSound.preferredSounds)) c.ambientSound.preferredSounds = ["rain","cafe","forest"];

  // Whisper
  c.whisper = { ...c.whisper };
  if (typeof c.whisper.enabled !== "boolean") c.whisper.enabled = false;
  c.whisper.frequency = clamp(c.whisper.frequency ?? 0.2, 0, 1);
  if (!["speech","subtitle","popup"].includes(c.whisper.style)) c.whisper.style = "subtitle";
  if (!Array.isArray(c.whisper.categories)) c.whisper.categories = ["encouragement","humor","facts","comfort"];
  if (!Array.isArray(c.whisper.customMessages)) c.whisper.customMessages = [];

  // Entity Relations
  c.entityRelations = { ...c.entityRelations };
  if (typeof c.entityRelations.enabled !== "boolean") c.entityRelations.enabled = true;
  if (!Array.isArray(c.entityRelations.relationships)) c.entityRelations.relationships = [];
  if (typeof c.entityRelations.autoEvolve !== "boolean") c.entityRelations.autoEvolve = true;

  // Drag
  c.drag = { ...c.drag };
  if (typeof c.drag.enabled !== "boolean") c.drag.enabled = false;
  c.drag.grabRadius = clamp(c.drag.grabRadius ?? 40, 20, 100);
  if (!["bounce","settle","celebrate"].includes(c.drag.releaseBehavior)) c.drag.releaseBehavior = "bounce";
  if (typeof c.drag.rememberSpots !== "boolean") c.drag.rememberSpots = true;

  // Profiles
  c.profiles = { ...c.profiles };
  if (!Array.isArray(c.profiles.savedProfiles)) c.profiles.savedProfiles = [];
  if (typeof c.profiles.hotkeySwap !== "boolean") c.profiles.hotkeySwap = false;
  if (!Array.isArray(c.profiles.autoSwitchRules)) c.profiles.autoSwitchRules = [];

  // Dream
  c.dream = { ...c.dream };
  if (typeof c.dream.enabled !== "boolean") c.dream.enabled = true;
  c.dream.particleDensity = clamp(c.dream.particleDensity ?? 0.5, 0, 1);
  c.dream.thoughtFrequency = clamp(c.dream.thoughtFrequency ?? 0.3, 0, 1);
  if (typeof c.dream.colorWash !== "boolean") c.dream.colorWash = true;
  c.dream.maxDreamParticles = Math.round(clamp(c.dream.maxDreamParticles ?? 12, 5, 20));

  // Focus Target
  c.focusTarget = { ...c.focusTarget };
  if (typeof c.focusTarget.enabled !== "boolean") c.focusTarget.enabled = true;
  c.focusTarget.windowAttraction = clamp(c.focusTarget.windowAttraction ?? 0.4, 0, 1);
  c.focusTarget.cursorAttraction = clamp(c.focusTarget.cursorAttraction ?? 0.3, 0, 1);
  c.focusTarget.gamingWindowBoost = clamp(c.focusTarget.gamingWindowBoost ?? 0.35, 0, 1);
  c.focusTarget.gamingCursorBoost = clamp(c.focusTarget.gamingCursorBoost ?? 0.3, 0, 1);
  c.focusTarget.blendFactor = clamp(c.focusTarget.blendFactor ?? 0.35, 0, 1);
  c.focusTarget.habitatSoftening = clamp(c.focusTarget.habitatSoftening ?? 0.5, 0, 1);

  // AI
  c.ai = { ...c.ai };
  if (typeof c.ai.enabled !== "boolean") c.ai.enabled = false;
  if (c.ai.provider !== "openrouter") c.ai.provider = "openrouter";
  if (typeof c.ai.model !== "string" || !c.ai.model) c.ai.model = "openrouter/auto";
  if (typeof c.ai.periodicEnabled !== "boolean") c.ai.periodicEnabled = false;
  c.ai.periodicIntervalSec = Math.round(clamp(c.ai.periodicIntervalSec ?? 300, 30, 3600));
  c.ai.periodicInsightPriority = clamp(c.ai.periodicInsightPriority ?? 0.8, 0, 1);
  if (typeof c.ai.sendScreenshot !== "boolean") c.ai.sendScreenshot = false;
  c.ai.screenshotMaxWidth = Math.round(clamp(c.ai.screenshotMaxWidth ?? 1280, 320, 1920));
  c.ai.screenshotJpegQuality = Math.round(clamp(c.ai.screenshotJpegQuality ?? 75, 40, 90));
  if (!Array.isArray(c.ai.screenshotMonitorIndices)) c.ai.screenshotMonitorIndices = [];
  c.ai.screenshotMonitorIndices = c.ai.screenshotMonitorIndices
    .filter((idx) => typeof idx === "number" && idx >= 0 && idx < 16)
    .map((idx) => Math.round(idx));
  if (typeof c.ai.screenshotMonitorQualities !== "object" || c.ai.screenshotMonitorQualities === null)
    c.ai.screenshotMonitorQualities = {};
  const validQualities: Record<number, number> = {};
  for (const [k, v] of Object.entries(c.ai.screenshotMonitorQualities)) {
    const idx = Number(k);
    if (!isNaN(idx) && idx >= 0 && idx < 16 && typeof v === "number") {
      validQualities[idx] = Math.round(clamp(v, 40, 90));
    }
  }
  c.ai.screenshotMonitorQualities = validQualities;
  if (typeof c.ai.includeForegroundApp !== "boolean") c.ai.includeForegroundApp = true;
  c.ai.instaSendCooldownSec = Math.round(clamp(c.ai.instaSendCooldownSec ?? 5, 1, 60));
  c.ai.requestTimeoutSec = Math.round(clamp(c.ai.requestTimeoutSec ?? 30, 5, 120));
  c.ai.maxThoughtChars = Math.round(clamp(c.ai.maxThoughtChars ?? 120, 40, 240));
  c.ai.maxWhisperChars = Math.round(clamp(c.ai.maxWhisperChars ?? 180, 40, 320));

  // Toys
  if (typeof c.toys !== "object" || c.toys === null) c.toys = { enabled: false, placedToys: [], respawnTreatsMin: 10, laserFollowsCursor: false, siblingsPlay: true, maxToys: 30 };
  if (typeof c.toys.enabled !== "boolean") c.toys.enabled = false;
  if (!Array.isArray(c.toys.placedToys)) c.toys.placedToys = [];
  c.toys.maxToys = Math.round(clamp(c.toys.maxToys ?? 30, 5, 30));
  c.toys.placedToys = c.toys.placedToys.slice(0, c.toys.maxToys);
  c.toys.respawnTreatsMin = Math.round(clamp(c.toys.respawnTreatsMin ?? 10, 0, 120));
  if (typeof c.toys.laserFollowsCursor !== "boolean") c.toys.laserFollowsCursor = false;
  if (typeof c.toys.siblingsPlay !== "boolean") c.toys.siblingsPlay = true;

  // Experimental
  if (typeof c.experimental !== "object" || c.experimental === null) {
    c.experimental = { enabled: false, interactionRadius: 150, autoInteract: false, allowedInteractions: ["click"], rateLimitSec: 5, optInAcknowledged: false, targetMode: "toys", allowedApps: [] };
  }
  if (typeof c.experimental.enabled !== "boolean") c.experimental.enabled = false;
  c.experimental.interactionRadius = clamp(c.experimental.interactionRadius ?? 150, 50, 400);
  c.experimental.rateLimitSec = Math.round(clamp(c.experimental.rateLimitSec ?? 5, 1, 60));
  if (typeof c.experimental.autoInteract !== "boolean") c.experimental.autoInteract = false;
  if (typeof c.experimental.optInAcknowledged !== "boolean") c.experimental.optInAcknowledged = false;
  if (!Array.isArray(c.experimental.allowedInteractions)) c.experimental.allowedInteractions = ["click"];
  c.experimental.allowedInteractions = c.experimental.allowedInteractions.filter((t: string) => t === "click" || t === "hover" || t === "type");
  if (c.experimental.targetMode !== "toys" && c.experimental.targetMode !== "allowlist") c.experimental.targetMode = "toys";
  if (!Array.isArray(c.experimental.allowedApps)) c.experimental.allowedApps = [];

  // Digest (v8.2)
  if (typeof c.digest !== "object" || c.digest === null) {
    c.digest = { enabled: true, autoDismissSec: 9, showBond: true, showStats: true, showMood: true, showGrowth: true, showHighlight: true };
  }
  if (typeof c.digest.enabled !== "boolean") c.digest.enabled = true;
  c.digest.autoDismissSec = Math.round(clamp(c.digest.autoDismissSec ?? 9, 4, 30));
  if (typeof c.digest.showBond !== "boolean") c.digest.showBond = true;
  if (typeof c.digest.showStats !== "boolean") c.digest.showStats = true;
  if (typeof c.digest.showMood !== "boolean") c.digest.showMood = true;
  if (typeof c.digest.showGrowth !== "boolean") c.digest.showGrowth = true;
  if (typeof c.digest.showHighlight !== "boolean") c.digest.showHighlight = true;

  // Chronicle (v8.3)
  if (typeof c.chronicle !== "object" || c.chronicle === null) {
    c.chronicle = { enabled: true, snapshotHour: 21, retentionDays: 90, autoDismissSec: 12, showTrend: true, showInsights: true };
  }
  if (typeof c.chronicle.enabled !== "boolean") c.chronicle.enabled = true;
  c.chronicle.snapshotHour = Math.round(clamp(c.chronicle.snapshotHour ?? 21, 0, 23));
  c.chronicle.retentionDays = Math.round(clamp(c.chronicle.retentionDays ?? 90, 30, 365));
  c.chronicle.autoDismissSec = Math.round(clamp(c.chronicle.autoDismissSec ?? 12, 4, 30));
  if (typeof c.chronicle.showTrend !== "boolean") c.chronicle.showTrend = true;
  if (typeof c.chronicle.showInsights !== "boolean") c.chronicle.showInsights = true;

  // Intent (v9.0)
  if (typeof c.intent !== "object" || c.intent === null) {
    c.intent = { enabled: true, changeRate: 0.5, showInDebug: true, thoughtChance: 0.4 };
  }
  if (typeof c.intent.enabled !== "boolean") c.intent.enabled = true;
  c.intent.changeRate = clamp(c.intent.changeRate ?? 0.5, 0, 1);
  if (typeof c.intent.showInDebug !== "boolean") c.intent.showInDebug = true;
  c.intent.thoughtChance = clamp(c.intent.thoughtChance ?? 0.4, 0, 1);

  // Story (v9.0)
  if (typeof c.story !== "object" || c.story === null) {
    c.story = { enabled: true, weekday: 0, hour: 20, retentionWeeks: 26, autoDismissSec: 15, aiPolish: false };
  }
  if (typeof c.story.enabled !== "boolean") c.story.enabled = true;
  c.story.weekday = Math.round(clamp(c.story.weekday ?? 0, 0, 6));
  c.story.hour = Math.round(clamp(c.story.hour ?? 20, 0, 23));
  c.story.retentionWeeks = Math.round(clamp(c.story.retentionWeeks ?? 26, 4, 52));
  c.story.autoDismissSec = Math.round(clamp(c.story.autoDismissSec ?? 15, 4, 60));
  if (typeof c.story.aiPolish !== "boolean") c.story.aiPolish = false;

  // Recall (v9.0)
  if (typeof c.recall !== "object" || c.recall === null) {
    c.recall = { enabled: true, chance: 0.25, minSignificance: 0.6, maxAgeDays: 60 };
  }
  if (typeof c.recall.enabled !== "boolean") c.recall.enabled = true;
  c.recall.chance = clamp(c.recall.chance ?? 0.25, 0, 1);
  c.recall.minSignificance = clamp(c.recall.minSignificance ?? 0.6, 0.4, 0.9);
  c.recall.maxAgeDays = Math.round(clamp(c.recall.maxAgeDays ?? 60, 7, 180));

  // Chat (v9.0)
  if (typeof c.chat !== "object" || c.chat === null) {
    c.chat = { enabled: false, persistHistory: false, maxTurns: 12, sendScreenshot: false, panelPosition: "near-kovy" };
  }
  if (typeof c.chat.enabled !== "boolean") c.chat.enabled = false;
  if (typeof c.chat.persistHistory !== "boolean") c.chat.persistHistory = false;
  c.chat.maxTurns = Math.round(clamp(c.chat.maxTurns ?? 12, 4, 30));
  if (typeof c.chat.sendScreenshot !== "boolean") c.chat.sendScreenshot = false;
  if (c.chat.panelPosition !== "near-kovy" && c.chat.panelPosition !== "bottom-right") c.chat.panelPosition = "near-kovy";

  return c;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampToSet(value: number, validValues: number[]): number {
  let closest = validValues[0];
  let minDist = Math.abs(value - closest);
  for (const v of validValues) {
    const dist = Math.abs(value - v);
    if (dist < minDist) {
      minDist = dist;
      closest = v;
    }
  }
  return closest;
}

/** Safely import a config: validate, deep-merge with defaults, clamp values.
 *  A backup of the raw input is saved to localStorage before migration so
 *  users can recover if a migration corrupts the config. */
export function safeImportConfig(raw: unknown): {
  config: KovyConfig | null;
  errors: string[];
  migrated: boolean;
} {
  // Backup raw config before migration (best-effort, non-blocking)
  if (typeof raw === "object" && raw !== null) {
    try {
      const version = (raw as Record<string, unknown>).version;
      if (typeof version === "number" && version < CONFIG_VERSION) {
        localStorage.setItem(
          "kovy-config-backup",
          JSON.stringify({ savedAt: Date.now(), version, config: raw }),
        );
      }
    } catch { /* localStorage may be unavailable — non-fatal */ }
  }

  const validation = validateConfig(raw);

  if (!validation.valid && validation.errors.some(e => e.includes("not an object") || e.includes("newer than"))) {
    return { config: null, errors: validation.errors, migrated: false };
  }

  // Deep merge with defaults to fill any missing nested keys
  const defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const incoming = raw as Record<string, unknown>;
  const merged = deepMerge(defaults, incoming) as KovyConfig;
  merged.version = CONFIG_VERSION;

  // Clamp all values to valid ranges
  const clamped = clampConfig(merged);

  return {
    config: clamped,
    errors: validation.errors,
    migrated: validation.migrated,
  };
}

/** Retrieve the last config backup saved before a migration. Returns null if none. */
export function getConfigBackup(): { savedAt: number; version: number; config: unknown } | null {
  try {
    const raw = localStorage.getItem("kovy-config-backup");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
