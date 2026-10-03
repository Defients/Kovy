// ============================================================
// Config migration registry — each step upgrades config from v(n) to v(n+1)
// ============================================================

type ConfigObj = Record<string, unknown>;

export interface MigrationStep {
  fromVersion: number;
  description: string;
  migrate: (obj: ConfigObj) => void;
}

export const MIGRATION_REGISTRY: MigrationStep[] = [
  {
    fromVersion: 1,
    description: "v1 → v2: add habitat section, add hyper sub-config to behavior",
    migrate: (obj) => {
      if (!obj.habitat) {
        obj.habitat = { enabled: false, homes: [], zones: [], rails: [], nodes: [] };
      }
      const beh = obj.behavior as ConfigObj | undefined;
      if (beh && !beh.hyper) {
        beh.hyper = {
          dashStrength: 0.7, chainDelay: 0.4, orbitBurstDuration: 0.8,
          targetChainThreshold: 0.3, maxChainRate: 6, dashCooldown: 0.5,
        };
      }
    },
  },
  {
    fromVersion: 2,
    description: "v2 → v3: remove dead audio fields, remove dead behavior fields",
    migrate: (obj) => {
      const aud = obj.audio as ConfigObj | undefined;
      if (aud) {
        delete aud.reactToSystemAudio;
        delete aud.muteInMeetings;
        delete aud.systemAudioSensitivity;
      }
      const beh = obj.behavior as ConfigObj | undefined;
      if (beh) {
        delete beh.activeMonitorBias;
        delete beh.notificationBoost;
        delete beh.ignorePassiveVideo;
      }
    },
  },
  {
    fromVersion: 3,
    description: "v3 → v4: add memory, family, muse sections",
    migrate: (obj) => {
      if (!obj.memory) {
        obj.memory = {
          enabled: true, maxMemories: 2000, retentionDays: 90,
          significanceThreshold: 0.3, storeAppNames: true,
          storeWindowTitles: false, pruneOnStartup: true,
          autoExportSoulDays: 0,
        };
      }
      if (!obj.family) {
        obj.family = {
          maxEntities: 1,
          dynamics: {
            curiosityContagion: 0.5, comfortInfluence: 0.5,
            playfulChaseChance: 0.3, synchronizedOrbit: true,
            groupHyperBursts: true, territoryRespect: 0.5,
          },
          showFamilyNames: false, familyUpdateIntervalMs: 500,
        };
      }
      if (!obj.muse) {
        obj.muse = {
          enabled: false, hotkey: "Alt+Shift+M", maxOverlays: 6,
          overlayLifetime: 5, style: "subtle",
          contextUpdateIntervalMs: 3000, codeMode: true,
          writingMode: true, designMode: true,
        };
      }
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk && !hk.toggleMuse) {
        hk.toggleMuse = "Alt+Shift+M";
      }
    },
  },
  {
    fromVersion: 4,
    description: "v4 → v5: add gaming section",
    migrate: (obj) => {
      if (!obj.gaming) {
        obj.gaming = {
          enabled: false, hotkey: "Alt+Shift+G",
          predictiveBias: 0.5, excitementGain: 0.5,
          hyperBlend: 0.4, residueAmount: 0.5,
          residueLifetime: 0.6, elasticDeformation: 0.5,
          freeformWobble: 0.3, visualStyle: "surge",
        };
      }
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk && !hk.toggleGaming) {
        hk.toggleGaming = "Alt+Shift+G";
      }
    },
  },
  {
    fromVersion: 5,
    description: "v5 → v6: add circadian section",
    migrate: (obj) => {
      if (!obj.circadian) {
        obj.circadian = {
          enabled: true, adaptationRate: 0.3,
          amplifyDayNight: 0.5, dreamEnabled: true,
          startleEnabled: true, startleCooldown: 8,
        };
      }
    },
  },
  {
    fromVersion: 6,
    description: "v6 → v7: add emote and atmosphere sections",
    migrate: (obj) => {
      if (!obj.emote) {
        obj.emote = {
          enabled: true, intensity: 0.6, style: "bubble", maxActive: 6,
        };
      }
      if (!obj.atmosphere) {
        obj.atmosphere = {
          enabled: true, density: 0.4, style: "organic",
          circadianSync: true, moodSync: true,
        };
      }
    },
  },
  {
    fromVersion: 7,
    description: "v7 → v8: expand audio config with frequency/cooldown/sound enables",
    migrate: (obj) => {
      const aud = obj.audio as ConfigObj | undefined;
      if (aud) {
        if (aud.ambientFrequency === undefined) aud.ambientFrequency = 0.3;
        if (aud.reactionFrequency === undefined) aud.reactionFrequency = 0.6;
        if (aud.moodFrequency === undefined) aud.moodFrequency = 0.4;
        if (aud.globalCooldownMs === undefined) aud.globalCooldownMs = 1500;
        if (aud.soundEnables === undefined) aud.soundEnables = [];
      }
    },
  },
  {
    fromVersion: 8,
    description: "v8 → v9: add bond section",
    migrate: (obj) => {
      if (!obj.bond) {
        obj.bond = {
          enabled: true, bondDecayPerDay: 0.02,
          interactionRadius: 80, pokeStartleChance: 0.3,
        };
      }
    },
  },
  {
    fromVersion: 9,
    description: "v9 → v10: add milestone section, remove dead showTrayIcon field",
    migrate: (obj) => {
      if (!obj.milestone) {
        obj.milestone = {
          enabled: true, showNotifications: true, showProgressInTray: false,
        };
      }
      const gen = obj.general as ConfigObj | undefined;
      if (gen) {
        delete gen.showTrayIcon;
      }
    },
  },
  {
    fromVersion: 10,
    description: "v10 → v11: add ritual, journal, weather, skinPack, soundPack, familyScenes, appProfile, habitatObjects",
    migrate: (obj) => {
      if (!obj.ritual) {
        obj.ritual = {
          enabled: true, notifyOnRitual: true,
          morningGreeting: true, lunchCompanion: true,
          afternoonStretch: true, eveningWinddown: true,
          midnightDream: true, returnCelebration: true, weekendSpecial: true,
        };
      }
      if (!obj.journal) {
        obj.journal = { enabled: true, maxEntries: 1000, generateDailySummary: true };
      }
      if (!obj.weather) {
        obj.weather = {
          enabled: true, changeInterval: 600, intensity: 0.5,
          allowedTypes: ["clear", "cloudy", "rain", "storm", "snow", "fog", "aurora"],
        };
      }
      if (!obj.skinPack) {
        obj.skinPack = { activePackId: "default", customPacks: [] };
      }
      if (!obj.soundPack) {
        obj.soundPack = { activePackId: "default", customPacks: [] };
      }
      if (!obj.familyScenes) {
        obj.familyScenes = { enabled: true, cooldownMultiplier: 1.0, proximityThreshold: 400 };
      }
      if (!obj.appProfile) {
        obj.appProfile = { enabled: false, autoDetect: true, profiles: [] };
      }
      if (!obj.habitatObjects) {
        obj.habitatObjects = { enabled: true, maxObjects: 20, objects: [] };
      }
    },
  },
  {
    fromVersion: 11,
    description: "v11 → v12: add 14 new config sections + new fields to existing sections",
    migrate: (obj) => {
      const mood = obj.mood as ConfigObj | undefined;
      if (mood && mood.moodColorTransitionSpeed === undefined) mood.moodColorTransitionSpeed = 0.5;
      const perf = obj.performance as ConfigObj | undefined;
      if (perf && perf.adaptiveQuality === undefined) perf.adaptiveQuality = false;
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk) {
        if (hk.toggleDrag === undefined) hk.toggleDrag = "Alt+Shift+D";
        if (hk.toggleFocus === undefined) hk.toggleFocus = "Alt+Shift+F";
        if (hk.switchProfile === undefined) hk.switchProfile = "Alt+Shift+Tab";
      }
      const bond = obj.bond as ConfigObj | undefined;
      if (bond) {
        if (bond.bondMilestoneVfx === undefined) bond.bondMilestoneVfx = true;
        if (bond.doubleClickAction === undefined) bond.doubleClickAction = "celebrate";
        if (bond.rightClickMenu === undefined) bond.rightClickMenu = true;
      }
      const gaming = obj.gaming as ConfigObj | undefined;
      if (gaming) {
        if (gaming.comboSystem === undefined) gaming.comboSystem = true;
        if (gaming.comboDecayRate === undefined) gaming.comboDecayRate = 0.5;
      }
      const circ = obj.circadian as ConfigObj | undefined;
      if (circ) {
        if (circ.customSchedule === undefined) circ.customSchedule = false;
        if (circ.dayStartTime === undefined) circ.dayStartTime = 7;
        if (circ.nightStartTime === undefined) circ.nightStartTime = 20;
        if (circ.sleepTracking === undefined) circ.sleepTracking = false;
        if (circ.alarmTime === undefined) circ.alarmTime = null;
      }
      const atmos = obj.atmosphere as ConfigObj | undefined;
      if (atmos && atmos.seasonalSync === undefined) atmos.seasonalSync = true;
      const weather = obj.weather as ConfigObj | undefined;
      if (weather) {
        if (weather.realWeatherSync === undefined) weather.realWeatherSync = false;
        if (weather.realWeatherInterval === undefined) weather.realWeatherInterval = 1800;
        if (weather.realWeatherLocation === undefined) weather.realWeatherLocation = "";
      }
      const skin = obj.skinPack as ConfigObj | undefined;
      if (skin) {
        if (skin.circadianAutoSwitch === undefined) skin.circadianAutoSwitch = false;
        if (skin.nightPackId === undefined) skin.nightPackId = null;
      }
      const ritual = obj.ritual as ConfigObj | undefined;
      if (ritual) {
        if (ritual.coffeeBreak === undefined) ritual.coffeeBreak = true;
        if (ritual.sunsetReflection === undefined) ritual.sunsetReflection = true;
        if (ritual.lateNightSnack === undefined) ritual.lateNightSnack = true;
        if (ritual.firstSnow === undefined) ritual.firstSnow = true;
        if (ritual.morningGreetingTime === undefined) ritual.morningGreetingTime = 8;
        if (ritual.lunchTime === undefined) ritual.lunchTime = 12;
        if (ritual.afternoonStretchTime === undefined) ritual.afternoonStretchTime = 15;
        if (ritual.eveningWinddownTime === undefined) ritual.eveningWinddownTime = 19;
      }
      const famDyn = obj.family as ConfigObj | undefined;
      if (famDyn && famDyn.dynamics) {
        const dyn = famDyn.dynamics as ConfigObj;
        if (dyn.interEntityBonds === undefined) dyn.interEntityBonds = true;
        if (dyn.groupEmotes === undefined) dyn.groupEmotes = true;
      }
      const muse = obj.muse as ConfigObj | undefined;
      if (muse && muse.adaptiveSelection === undefined) muse.adaptiveSelection = true;
      if (!obj.audioReactivity) obj.audioReactivity = { enabled: false, sensitivity: 0.5, beatDetection: true, feedMood: true, feedGaming: false, feedVisualizer: true, visualizerStyle: "bars" };
      if (!obj.thought) obj.thought = { enabled: true, frequency: 0.3, maxActive: 2, style: "cloud", customThoughts: [] };
      if (!obj.seasonal) obj.seasonal = { enabled: true, events: ["halloween","christmas","newyear","valentines","stpatricks","summerSolstice","autumnEquinox"], customEvents: [], hemisphere: "northern" };
      if (!obj.growth) obj.growth = { enabled: true, agingRate: 1.0, stageThresholds: { young: 3, mature: 14, elder: 60 } };
      if (!obj.stats) obj.stats = { enabled: true, trackingLevel: "standard" };
      if (!obj.focus) obj.focus = { enabled: true, detectionSensitivity: 0.5, focusBehavior: "meditate", suppressEmotes: true, suppressSound: true };
      if (!obj.idle) obj.idle = { enabled: true, idleThresholdSec: 120, idleBehaviors: ["explore","play_alone","nap","dream"] };
      if (!obj.personalityEvolution) obj.personalityEvolution = { enabled: true, evolutionRate: 0.3 };
      if (!obj.celebration) obj.celebration = { enabled: true, focusThreshold: 25, returnThreshold: 24, weekendCelebration: true };
      if (!obj.ambientSound) obj.ambientSound = { enabled: false, volume: 0.3, syncWithWeather: true, preferredSounds: ["rain","cafe","forest"] };
      if (!obj.whisper) obj.whisper = { enabled: false, frequency: 0.2, style: "subtitle", categories: ["encouragement","humor","facts","comfort"], customMessages: [] };
      if (!obj.entityRelations) obj.entityRelations = { enabled: true, relationships: [], autoEvolve: true };
      if (!obj.drag) obj.drag = { enabled: false, grabRadius: 40, releaseBehavior: "bounce", rememberSpots: true };
      if (!obj.profiles) obj.profiles = { savedProfiles: [], activeProfileId: null, hotkeySwap: false };
    },
  },
  {
    fromVersion: 12,
    description: "v12 → v13: add experienceMode, toggleExperienceMode hotkey, shadowConfig",
    migrate: (obj) => {
      const gen = obj.general as ConfigObj | undefined;
      if (gen && gen.experienceMode === undefined) gen.experienceMode = "full";
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk && hk.toggleExperienceMode === undefined) hk.toggleExperienceMode = "Alt+Shift+L";
      if (obj.shadowConfig === undefined) obj.shadowConfig = null;
    },
  },
  {
    fromVersion: 13,
    description: "v13 → v14: add dream section, profile auto-switch rules, habitat presets",
    migrate: (obj) => {
      if (!obj.dream) {
        obj.dream = {
          enabled: true,
          particleDensity: 0.5,
          thoughtFrequency: 0.3,
          colorWash: true,
          maxDreamParticles: 12,
        };
      }
      const profiles = obj.profiles as ConfigObj | undefined;
      if (profiles && profiles.autoSwitchRules === undefined) {
        profiles.autoSwitchRules = [];
      }
      const habitat = obj.habitatObjects as ConfigObj | undefined;
      if (habitat && habitat.habitatPresets === undefined) {
        habitat.habitatPresets = [];
      }
    },
  },
  {
    fromVersion: 14,
    description: "v14 → v15: add focusTarget section for window/cursor attraction",
    migrate: (obj) => {
      if (!obj.focusTarget) {
        obj.focusTarget = {
          enabled: true,
          windowAttraction: 0.4,
          cursorAttraction: 0.3,
          gamingWindowBoost: 0.35,
          gamingCursorBoost: 0.3,
          blendFactor: 0.35,
          habitatSoftening: 0.5,
        };
      }
    },
  },
  {
    fromVersion: 15,
    description: "v15 → v16: add AI config section and askKovy hotkey",
    migrate: (obj) => {
      if (!obj.ai) {
        obj.ai = {
          enabled: false,
          provider: "openrouter",
          model: "openrouter/auto",
          periodicEnabled: false,
          periodicIntervalSec: 300,
          periodicInsightPriority: 0.8,
          sendScreenshot: false,
          screenshotMaxWidth: 1280,
          screenshotJpegQuality: 75,
          screenshotMonitorIndices: [],
          screenshotMonitorQualities: {},
          includeForegroundApp: true,
          instaSendCooldownSec: 5,
          requestTimeoutSec: 30,
          maxThoughtChars: 120,
          maxWhisperChars: 180,
        };
      }
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk && hk.askKovy === undefined) {
        hk.askKovy = "Alt+Shift+A";
      }
    },
  },
  {
    fromVersion: 16,
    description: "v16 → v17: add commandPalette hotkey",
    migrate: (obj) => {
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk && hk.commandPalette === undefined) {
        hk.commandPalette = "Alt+Space";
      }
    },
  },
  {
    fromVersion: 17,
    description: "v17 → v18: add toys section, add reticleStyle and customReticleDataUrl to advanced",
    migrate: (obj) => {
      if (!obj.toys) {
        obj.toys = { enabled: false, placedToys: [] };
      }
      const adv = obj.advanced as ConfigObj | undefined;
      if (adv) {
        if (adv.reticleStyle === undefined) adv.reticleStyle = "crosshair";
        if (adv.customReticleDataUrl === undefined) adv.customReticleDataUrl = null;
      }
    },
  },
  {
    fromVersion: 18,
    description: "v18 → v19: add experimental section for screen interaction",
    migrate: (obj) => {
      if (!obj.experimental) {
        obj.experimental = {
          enabled: false,
          interactionRadius: 150,
          autoInteract: false,
          allowedInteractions: ["click"],
          rateLimitSec: 5,
          optInAcknowledged: false,
        };
      }
    },
  },
  {
    fromVersion: 19,
    description: "v19 → v20: add privacy.hideFromCapture (overlay visible to OBS by default)",
    migrate: (obj) => {
      const privacy = obj.privacy as ConfigObj | undefined;
      if (privacy && privacy.hideFromCapture === undefined) {
        privacy.hideFromCapture = false;
      }
    },
  },
  {
    fromVersion: 20,
    description: "v20 → v21: add privacy.autoHideOnCaptureApp (auto-hide when OBS/streaming apps detected)",
    migrate: (obj) => {
      const privacy = obj.privacy as ConfigObj | undefined;
      if (privacy && privacy.autoHideOnCaptureApp === undefined) {
        privacy.autoHideOnCaptureApp = false;
      }
    },
  },
  {
    fromVersion: 21,
    description: "v21 → v22: add digest section + hotkeys.showDigest (companion digest overlay card)",
    migrate: (obj) => {
      if (!obj.digest) {
        obj.digest = {
          enabled: true,
          autoDismissSec: 9,
          showBond: true,
          showStats: true,
          showMood: true,
          showGrowth: true,
          showHighlight: true,
        };
      }
      const hotkeys = obj.hotkeys as ConfigObj | undefined;
      if (hotkeys && hotkeys.showDigest === undefined) {
        hotkeys.showDigest = "Alt+Shift+I";
      }
    },
  },
  {
    fromVersion: 22,
    description: "v22 → v23: add chronicle section + hotkeys.showChronicle (longitudinal companion trends)",
    migrate: (obj) => {
      if (!obj.chronicle) {
        obj.chronicle = {
          enabled: true,
          snapshotHour: 21,
          retentionDays: 90,
          autoDismissSec: 12,
          showTrend: true,
          showInsights: true,
        };
      }
      const hotkeys = obj.hotkeys as ConfigObj | undefined;
      if (hotkeys && hotkeys.showChronicle === undefined) {
        hotkeys.showChronicle = "Alt+Shift+Y";
      }
    },
  },
  {
    fromVersion: 23,
    description: "v23 → v24: add intent, story, recall, chat sections; new toys/experimental fields; new hotkeys",
    migrate: (obj) => {
      // New toys fields
      const toys = obj.toys as ConfigObj | undefined;
      if (toys) {
        if (toys.respawnTreatsMin === undefined) toys.respawnTreatsMin = 10;
        if (toys.laserFollowsCursor === undefined) toys.laserFollowsCursor = false;
        if (toys.siblingsPlay === undefined) toys.siblingsPlay = true;
        if (toys.maxToys === undefined) toys.maxToys = 30;
      }
      // New experimental fields
      const exp = obj.experimental as ConfigObj | undefined;
      if (exp) {
        if (exp.targetMode === undefined) exp.targetMode = "toys";
        if (exp.allowedApps === undefined) exp.allowedApps = [];
      }
      // New hotkeys
      const hk = obj.hotkeys as ConfigObj | undefined;
      if (hk) {
        if (hk.showStory === undefined) hk.showStory = "Alt+Shift+K";
        if (hk.openChat === undefined) hk.openChat = "Alt+Shift+C";
      }
      // New sections
      if (!obj.intent) {
        obj.intent = { enabled: true, changeRate: 0.5, showInDebug: true, thoughtChance: 0.4 };
      }
      if (!obj.story) {
        obj.story = { enabled: true, weekday: 0, hour: 20, retentionWeeks: 26, autoDismissSec: 15, aiPolish: false };
      }
      if (!obj.recall) {
        obj.recall = { enabled: true, chance: 0.25, minSignificance: 0.6, maxAgeDays: 60 };
      }
      if (!obj.chat) {
        obj.chat = { enabled: false, persistHistory: false, maxTurns: 12, sendScreenshot: false, panelPosition: "near-kovy" };
      }
    },
  },
];

/** Run all applicable migrations on a raw config object in-place */
export function runMigrations(obj: ConfigObj, fromVersion: number): boolean {
  let migrated = false;
  for (const step of MIGRATION_REGISTRY) {
    if (fromVersion <= step.fromVersion) {
      step.migrate(obj);
      migrated = true;
    }
  }
  return migrated;
}
