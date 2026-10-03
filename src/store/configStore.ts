import { create } from "zustand";
import type { KovyConfig } from "./types";
import { DEFAULT_CONFIG, BEHAVIOR_PRESETS } from "./defaults";
import type { BehaviorPreset, VisualPreset, PerformancePreset, ExperienceMode } from "./types";
import { safeImportConfig } from "./configValidation";
import { SCENARIO_PRESETS, getPresetById } from "./scenarioPresets";
import { emitPreview, emitApply, emitRevert } from "@/lib/configSyncBus";
import { applyLiteMask, removeLiteMask, captureShadowConfig } from "./liteMode";
import { getLitePresetById } from "./litePresets";

export interface ImportResult {
  success: boolean;
  errors: string[];
  migrated: boolean;
}

/**
 * Kovy 4.5 Config Store Architecture:
 *
 * - `appliedConfig`: the last persisted + committed config (what the overlay uses)
 * - `draftConfig`: the working copy edited in settings UI
 * - `isDirty`: true when draftConfig differs from appliedConfig
 * - `livePreview`: when true, draft changes emit preview events to overlay in real-time
 *
 * Flow:
 *   1. User edits → draftConfig updates (no persist, no emit unless livePreview)
 *   2. Apply → validate, persist, emit apply event, copy draft→applied
 *   3. Cancel → discard draft, restore from applied
 *   4. Live Preview → emit preview events as draft changes (no persist)
 */
interface ConfigStore {
  appliedConfig: KovyConfig;
  draftConfig: KovyConfig;
  loaded: boolean;
  isDirty: boolean;
  livePreview: boolean;
  lastImportResult: ImportResult | null;

  // Lifecycle
  loadConfig: () => Promise<void>;

  // Draft operations (settings window only)
  updateDraft: (section: string, patch: Record<string, unknown>) => void;
  updateDraftGeneral: (patch: Partial<KovyConfig["general"]>) => void;
  updateDraftAppearance: (patch: Partial<KovyConfig["appearance"]>) => void;
  updateDraftBehavior: (patch: Partial<KovyConfig["behavior"]>) => void;
  updateDraftVision: (patch: Partial<KovyConfig["vision"]>) => void;
  updateDraftMood: (patch: Partial<KovyConfig["mood"]>) => void;
  updateDraftPerformance: (patch: Partial<KovyConfig["performance"]>) => void;
  updateDraftPrivacy: (patch: Partial<KovyConfig["privacy"]>) => void;
  updateDraftAudio: (patch: Partial<KovyConfig["audio"]>) => void;
  updateDraftHotkeys: (patch: Partial<KovyConfig["hotkeys"]>) => void;
  updateDraftAdvanced: (patch: Partial<KovyConfig["advanced"]>) => void;
  updateDraftHabitat: (patch: Partial<KovyConfig["habitat"]>) => void;
  updateDraftMemory: (patch: Partial<KovyConfig["memory"]>) => void;
  updateDraftFamily: (patch: Partial<KovyConfig["family"]>) => void;
  updateDraftMuse: (patch: Partial<KovyConfig["muse"]>) => void;
  updateDraftGaming: (patch: Partial<KovyConfig["gaming"]>) => void;
  updateDraftCircadian: (patch: Partial<KovyConfig["circadian"]>) => void;
  updateDraftEmote: (patch: Partial<KovyConfig["emote"]>) => void;
  updateDraftAtmosphere: (patch: Partial<KovyConfig["atmosphere"]>) => void;
  updateDraftBond: (patch: Partial<KovyConfig["bond"]>) => void;
  updateDraftMilestone: (patch: Partial<KovyConfig["milestone"]>) => void;
  updateDraftRitual: (patch: Partial<KovyConfig["ritual"]>) => void;
  updateDraftJournal: (patch: Partial<KovyConfig["journal"]>) => void;
  updateDraftWeather: (patch: Partial<KovyConfig["weather"]>) => void;
  updateDraftSkinPack: (patch: Partial<KovyConfig["skinPack"]>) => void;
  updateDraftSoundPack: (patch: Partial<KovyConfig["soundPack"]>) => void;
  updateDraftFamilyScenes: (patch: Partial<KovyConfig["familyScenes"]>) => void;
  updateDraftAppProfile: (patch: Partial<KovyConfig["appProfile"]>) => void;
  updateDraftHabitatObjects: (patch: Partial<KovyConfig["habitatObjects"]>) => void;
  updateDraftDream: (patch: Partial<KovyConfig["dream"]>) => void;
  updateDraftFocusTarget: (patch: Partial<KovyConfig["focusTarget"]>) => void;
  updateDraftEntityRelations: (patch: Partial<KovyConfig["entityRelations"]>) => void;
  updateDraftPersonalityEvolution: (patch: Partial<KovyConfig["personalityEvolution"]>) => void;
  updateDraftCelebration: (patch: Partial<KovyConfig["celebration"]>) => void;
  updateDraftToys: (patch: Partial<KovyConfig["toys"]>) => void;
  updateDraftExperimental: (patch: Partial<KovyConfig["experimental"]>) => void;
  updateDraftStats: (patch: Partial<KovyConfig["stats"]>) => void;
  updateDraftProfiles: (patch: Partial<KovyConfig["profiles"]>) => void;
  updateDraftAi: (patch: Partial<KovyConfig["ai"]>) => void;
  updateDraftDigest: (patch: Partial<KovyConfig["digest"]>) => void;
  updateDraftChronicle: (patch: Partial<KovyConfig["chronicle"]>) => void;
  updateDraftIntent: (patch: Partial<KovyConfig["intent"]>) => void;
  updateDraftStory: (patch: Partial<KovyConfig["story"]>) => void;
  updateDraftRecall: (patch: Partial<KovyConfig["recall"]>) => void;
  updateDraftChat: (patch: Partial<KovyConfig["chat"]>) => void;

  // Preset helpers (update draft, not applied)
  applyBehaviorPresetToDraft: (preset: BehaviorPreset) => void;
  applyVisualPresetToDraft: (preset: VisualPreset) => void;
  applyPerformancePresetToDraft: (preset: PerformancePreset) => void;
  applyScenarioPresetToDraft: (presetId: string) => void;

  // Apply / Cancel / Reset
  applyConfig: () => Promise<void>;
  cancelDraft: () => void;
  resetSection: (section: keyof KovyConfig) => void;
  resetAllConfig: () => Promise<void>;

  // Live preview toggle
  setLivePreview: (enabled: boolean) => void;

  // Onboarding
  setOnboardingComplete: () => Promise<void>;

  // Import / Export
  exportConfig: () => string;
  importConfig: (json: string) => Promise<ImportResult>;

  // Habitat editing specific
  previewHabitat: (habitat: KovyConfig["habitat"]) => void;
  applyHabitat: (habitat: KovyConfig["habitat"]) => Promise<void>;

  // Direct applied config update (used by overlay to receive apply events)
  receiveAppliedConfig: (config: KovyConfig) => void;

  // Experience mode (Lite / Full)
  setExperienceMode: (mode: ExperienceMode) => Promise<void>;
  applyLitePresetToDraft: (presetId: string) => void;

  // Runtime privacy override (used by capture-app auto-hide runner)
  setHideFromCaptureRuntime: (hide: boolean) => Promise<void>;
}

const STORE_KEY = "kovy-config";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function configsEqual(a: KovyConfig, b: KovyConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shouldPreviewAdvancedPatch(section: string, patch: Record<string, unknown>): boolean {
  if (section !== "advanced") return false;
  return ["debugMode", "motionOverlay", "targetReticle", "salienceGraph", "habitatOverlay"]
    .some((key) => key in patch);
}

// Tauri plugin-store persistence with localStorage fallback
let tauriStore: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void>; save: () => Promise<void> } | null = null;
let storeInitPromise: Promise<void> | null = null;

async function initTauriStore(): Promise<void> {
  if (tauriStore) return;
  if (storeInitPromise) { await storeInitPromise; return; }
  storeInitPromise = (async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      tauriStore = await load("kovy-settings.json");
    } catch {
      console.log("Kovy: Tauri store not available, using localStorage");
    }
  })();
  await storeInitPromise;
}

async function persistConfig(config: KovyConfig): Promise<void> {
  try {
    await initTauriStore();
    if (tauriStore) {
      await tauriStore.set(STORE_KEY, config);
      await tauriStore.save();
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORE_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.warn("Failed to persist config:", e);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORE_KEY, JSON.stringify(config));
      }
    } catch {
      console.error("Failed to persist config to any store");
    }
  }
}

async function loadPersistedConfig(): Promise<KovyConfig | null> {
  try {
    await initTauriStore();
    if (tauriStore) {
      const raw = await tauriStore.get(STORE_KEY);
      if (raw && typeof raw === "object") {
        const result = safeImportConfig(raw);
        return result.config;
      }
    }
    if (typeof localStorage !== "undefined") {
      const localRaw = localStorage.getItem(STORE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        const result = safeImportConfig(parsed);
        if (result.config) {
          await persistConfig(result.config);
          localStorage.removeItem(STORE_KEY);
        }
        return result.config;
      }
    }
    return null;
  } catch (e) {
    console.warn("Failed to load persisted config:", e);
    return null;
  }
}

export const VISUAL_PRESET_MAP: Record<VisualPreset, Partial<KovyConfig["appearance"]>> = {
  minimal: {
    glowIntensity: 0.2,
    particleAmount: 0.1,
    trailLength: 0.1,
    shadowSoftness: 0.2,
    emoteIntensity: 0.3,
    renderFpsCap: 30,
    accessoriesEnabled: false,
    auroraBackground: false,
    particleBursts: false,
  },
  balanced: {
    glowIntensity: 0.6,
    particleAmount: 0.5,
    trailLength: 0.4,
    shadowSoftness: 0.5,
    emoteIntensity: 0.6,
    renderFpsCap: 60,
    accessoriesEnabled: true,
    auroraBackground: true,
    particleBursts: true,
  },
  high: {
    glowIntensity: 0.8,
    particleAmount: 0.75,
    trailLength: 0.7,
    shadowSoftness: 0.7,
    emoteIntensity: 0.8,
    renderFpsCap: 60,
    accessoriesEnabled: true,
    auroraBackground: true,
    particleBursts: true,
  },
  ultra: {
    glowIntensity: 1.0,
    particleAmount: 1.0,
    trailLength: 1.0,
    shadowSoftness: 1.0,
    emoteIntensity: 1.0,
    renderFpsCap: 120,
    accessoriesEnabled: true,
    auroraBackground: true,
    particleBursts: true,
  },
};

export const PERF_PRESET_MAP: Record<PerformancePreset, Partial<KovyConfig["performance"]>> = {
  battery: {
    backgroundThrottling: true,
    batteryThrottling: true,
    cpuBudget: 2,
    maxAnalysisFps: 2,
    maxRenderFps: 30,
    lowPowerIdle: true,
    frameSkipping: true,
  },
  balanced: {
    backgroundThrottling: true,
    batteryThrottling: true,
    cpuBudget: 5,
    maxAnalysisFps: 6,
    maxRenderFps: 60,
    lowPowerIdle: true,
    frameSkipping: true,
  },
  quality: {
    backgroundThrottling: false,
    batteryThrottling: false,
    cpuBudget: 10,
    maxAnalysisFps: 10,
    maxRenderFps: 60,
    lowPowerIdle: false,
    frameSkipping: false,
  },
  ultra: {
    backgroundThrottling: false,
    batteryThrottling: false,
    cpuBudget: 20,
    maxAnalysisFps: 15,
    maxRenderFps: 120,
    lowPowerIdle: false,
    frameSkipping: false,
  },
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  appliedConfig: deepClone(DEFAULT_CONFIG),
  draftConfig: deepClone(DEFAULT_CONFIG),
  loaded: false,
  isDirty: false,
  livePreview: false,
  lastImportResult: null,

  loadConfig: async () => {
    const persisted = await loadPersistedConfig();
    if (persisted) {
      set({
        appliedConfig: deepClone(persisted),
        draftConfig: deepClone(persisted),
        loaded: true,
        isDirty: false,
      });
    } else {
      set({ loaded: true });
    }
  },

  // Generic section update for draft
  updateDraft: (section, patch) => {
    set((state) => {
      const current = state.draftConfig[section as keyof KovyConfig];
      if (typeof current !== "object" || current === null) return state;
      const currentObj = current as unknown as Record<string, unknown>;
      const newDraft = {
        ...state.draftConfig,
        [section]: { ...currentObj, ...patch },
      };
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if ((state.livePreview && dirty) || shouldPreviewAdvancedPatch(section, patch)) {
        emitPreview(newDraft);
      }
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  updateDraftGeneral: (patch) => get().updateDraft("general", patch),
  updateDraftAppearance: (patch) => get().updateDraft("appearance", patch),
  updateDraftBehavior: (patch) => get().updateDraft("behavior", patch as Record<string, unknown>),
  updateDraftVision: (patch) => get().updateDraft("vision", patch),
  updateDraftMood: (patch) => get().updateDraft("mood", patch as Record<string, unknown>),
  updateDraftPerformance: (patch) => get().updateDraft("performance", patch),
  updateDraftPrivacy: (patch) => get().updateDraft("privacy", patch),
  updateDraftAudio: (patch) => get().updateDraft("audio", patch),
  updateDraftHotkeys: (patch) => get().updateDraft("hotkeys", patch),
  updateDraftAdvanced: (patch) => get().updateDraft("advanced", patch),
  updateDraftHabitat: (patch) => get().updateDraft("habitat", patch as Record<string, unknown>),
  updateDraftMemory: (patch) => get().updateDraft("memory", patch),
  updateDraftFamily: (patch) => get().updateDraft("family", patch as Record<string, unknown>),
  updateDraftMuse: (patch) => get().updateDraft("muse", patch as Record<string, unknown>),
  updateDraftGaming: (patch) => get().updateDraft("gaming", patch as Record<string, unknown>),
  updateDraftCircadian: (patch) => get().updateDraft("circadian", patch as Record<string, unknown>),
  updateDraftEmote: (patch) => get().updateDraft("emote", patch as Record<string, unknown>),
  updateDraftAtmosphere: (patch) => get().updateDraft("atmosphere", patch as Record<string, unknown>),
  updateDraftBond: (patch) => get().updateDraft("bond", patch as Record<string, unknown>),
  updateDraftMilestone: (patch) => get().updateDraft("milestone", patch as Record<string, unknown>),
  updateDraftRitual: (patch) => get().updateDraft("ritual", patch as Record<string, unknown>),
  updateDraftJournal: (patch) => get().updateDraft("journal", patch as Record<string, unknown>),
  updateDraftWeather: (patch) => get().updateDraft("weather", patch as Record<string, unknown>),
  updateDraftSkinPack: (patch) => get().updateDraft("skinPack", patch as Record<string, unknown>),
  updateDraftSoundPack: (patch) => get().updateDraft("soundPack", patch as Record<string, unknown>),
  updateDraftFamilyScenes: (patch) => get().updateDraft("familyScenes", patch as Record<string, unknown>),
  updateDraftAppProfile: (patch) => get().updateDraft("appProfile", patch as Record<string, unknown>),
  updateDraftHabitatObjects: (patch) => get().updateDraft("habitatObjects", patch as Record<string, unknown>),
  updateDraftDream: (patch) => get().updateDraft("dream", patch as Record<string, unknown>),
  updateDraftFocusTarget: (patch) => get().updateDraft("focusTarget", patch as Record<string, unknown>),
  updateDraftEntityRelations: (patch) => get().updateDraft("entityRelations", patch as Record<string, unknown>),
  updateDraftPersonalityEvolution: (patch) => get().updateDraft("personalityEvolution", patch as Record<string, unknown>),
  updateDraftCelebration: (patch) => get().updateDraft("celebration", patch as Record<string, unknown>),
  updateDraftToys: (patch) => get().updateDraft("toys", patch as Record<string, unknown>),
  updateDraftExperimental: (patch) => get().updateDraft("experimental", patch as Record<string, unknown>),
  updateDraftStats: (patch) => get().updateDraft("stats", patch as Record<string, unknown>),
  updateDraftProfiles: (patch) => get().updateDraft("profiles", patch as Record<string, unknown>),
  updateDraftAi: (patch) => get().updateDraft("ai", patch as Record<string, unknown>),
  updateDraftDigest: (patch) => get().updateDraft("digest", patch as Record<string, unknown>),
  updateDraftChronicle: (patch) => get().updateDraft("chronicle", patch as Record<string, unknown>),
  updateDraftIntent: (patch) => get().updateDraft("intent", patch as Record<string, unknown>),
  updateDraftStory: (patch) => get().updateDraft("story", patch as Record<string, unknown>),
  updateDraftRecall: (patch) => get().updateDraft("recall", patch as Record<string, unknown>),
  updateDraftChat: (patch) => get().updateDraft("chat", patch as Record<string, unknown>),

  applyBehaviorPresetToDraft: (preset) => {
    const values = BEHAVIOR_PRESETS[preset];
    set((state) => {
      const newDraft = {
        ...state.draftConfig,
        behavior: { ...state.draftConfig.behavior, ...values, preset },
      };
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if (state.livePreview) emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  applyVisualPresetToDraft: (preset) => {
    const values = VISUAL_PRESET_MAP[preset];
    set((state) => {
      const newDraft = {
        ...state.draftConfig,
        appearance: { ...state.draftConfig.appearance, ...values, visualPreset: preset },
      };
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if (state.livePreview) emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  applyPerformancePresetToDraft: (preset) => {
    const values = PERF_PRESET_MAP[preset];
    set((state) => {
      const newDraft = {
        ...state.draftConfig,
        performance: { ...state.draftConfig.performance, ...values, preset },
      };
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if (state.livePreview) emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  applyScenarioPresetToDraft: (presetId) => {
    const preset = getPresetById(presetId);
    if (!preset) return;
    const current = get().draftConfig;
    const patches = preset.apply(current);
    set((state) => {
      const newDraft = { ...state.draftConfig };
      for (const [key, value] of Object.entries(patches)) {
        (newDraft as any)[key] = value;
      }
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if (state.livePreview) emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  applyConfig: async () => {
    const { draftConfig } = get();
    const validated = safeImportConfig(draftConfig);
    const config = validated.config ?? draftConfig;

    await persistConfig(config);
    await emitApply(config);

    set({
      appliedConfig: deepClone(config),
      draftConfig: deepClone(config),
      isDirty: false,
    });
  },

  cancelDraft: () => {
    const { appliedConfig } = get();
    const restored = deepClone(appliedConfig);
    emitRevert(restored);
    set({
      draftConfig: restored,
      isDirty: false,
    });
  },

  resetSection: (section) => {
    const defaults = DEFAULT_CONFIG[section];
    if (defaults && typeof defaults === "object") {
      set((state) => {
        const newDraft = { ...state.draftConfig, [section]: deepClone(defaults) };
        const dirty = !configsEqual(newDraft, state.appliedConfig);
        if (state.livePreview) emitPreview(newDraft);
        return { draftConfig: newDraft, isDirty: dirty };
      });
    }
  },

  resetAllConfig: async () => {
    const fresh = deepClone(DEFAULT_CONFIG);
    fresh.onboardingComplete = get().appliedConfig.onboardingComplete;
    await persistConfig(fresh);
    await emitApply(fresh);
    set({
      appliedConfig: deepClone(fresh),
      draftConfig: deepClone(fresh),
      isDirty: false,
    });
  },

  setLivePreview: (enabled) => {
    set({ livePreview: enabled });
    if (enabled) {
      const { draftConfig, isDirty } = get();
      if (isDirty) emitPreview(draftConfig);
    } else {
      // When disabling live preview, revert overlay to applied
      const { appliedConfig } = get();
      emitRevert(appliedConfig);
    }
  },

  setOnboardingComplete: async () => {
    set((state) => {
      const newDraft = { ...state.draftConfig, onboardingComplete: true };
      const newApplied = { ...state.appliedConfig, onboardingComplete: true };
      persistConfig(newApplied);
      return { draftConfig: newDraft, appliedConfig: newApplied };
    });
  },

  exportConfig: () => {
    return JSON.stringify(get().appliedConfig, null, 2);
  },

  importConfig: async (json: string): Promise<ImportResult> => {
    try {
      const parsed = JSON.parse(json);
      const result = safeImportConfig(parsed);

      if (!result.config) {
        const importResult: ImportResult = {
          success: false,
          errors: result.errors,
          migrated: false,
        };
        set({ lastImportResult: importResult });
        return importResult;
      }

      result.config.onboardingComplete = get().appliedConfig.onboardingComplete;

      await persistConfig(result.config);
      await emitApply(result.config);

      const importResult: ImportResult = {
        success: true,
        errors: result.errors,
        migrated: result.migrated,
      };

      set({
        appliedConfig: deepClone(result.config),
        draftConfig: deepClone(result.config),
        isDirty: false,
        lastImportResult: importResult,
      });
      return importResult;
    } catch (e) {
      const importResult: ImportResult = {
        success: false,
        errors: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`],
        migrated: false,
      };
      set({ lastImportResult: importResult });
      return importResult;
    }
  },

  previewHabitat: (habitat) => {
    set((state) => {
      const newDraft = { ...state.draftConfig, habitat: deepClone(habitat) };
      emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: !configsEqual(newDraft, state.appliedConfig) };
    });
  },

  applyHabitat: async (habitat) => {
    const { appliedConfig } = get();
    const newConfig = { ...appliedConfig, habitat: deepClone(habitat) };
    
    await persistConfig(newConfig);
    await emitApply(newConfig);

    set({
      appliedConfig: deepClone(newConfig),
      draftConfig: deepClone(newConfig),
      isDirty: false,
    });
  },

  receiveAppliedConfig: (config) => {
    set({
      appliedConfig: deepClone(config),
      draftConfig: deepClone(config),
      isDirty: false,
    });
  },

  setExperienceMode: async (mode) => {
    const { draftConfig, appliedConfig } = get();
    let newConfig: KovyConfig;

    if (mode === "lite") {
      // Capture current settings as shadow before applying Lite mask
      const shadow = captureShadowConfig(draftConfig);
      newConfig = applyLiteMask(draftConfig);
      newConfig.shadowConfig = shadow;
    } else {
      // Restore shadow config values
      newConfig = removeLiteMask(draftConfig, draftConfig.shadowConfig);
      newConfig.shadowConfig = null;
    }

    await persistConfig(newConfig);
    await emitApply(newConfig);

    set({
      appliedConfig: deepClone(newConfig),
      draftConfig: deepClone(newConfig),
      isDirty: false,
    });
  },

  applyLitePresetToDraft: (presetId) => {
    const preset = getLitePresetById(presetId);
    if (!preset) return;
    const current = get().draftConfig;
    const patches = preset.apply(current);
    set((state) => {
      const newDraft = { ...state.draftConfig };
      for (const [key, value] of Object.entries(patches)) {
        (newDraft as unknown as Record<string, unknown>)[key] = value;
      }
      const dirty = !configsEqual(newDraft, state.appliedConfig);
      if (state.livePreview) emitPreview(newDraft);
      return { draftConfig: newDraft, isDirty: dirty };
    });
  },

  setHideFromCaptureRuntime: async (hide) => {
    const { appliedConfig } = get();
    if (appliedConfig.privacy.hideFromCapture === hide) {
      // Already in the desired state — still sync the backend to be safe.
      const { setHideFromCapture, setOverlayMasks } = await import("@/lib/tauriBridge");
      await setHideFromCapture(hide);
      if (hide) await setOverlayMasks([]);
      return;
    }
    const newConfig: KovyConfig = {
      ...appliedConfig,
      privacy: { ...appliedConfig.privacy, hideFromCapture: hide },
    };
    await persistConfig(newConfig);
    await emitApply(newConfig);
    set({
      appliedConfig: deepClone(newConfig),
      draftConfig: deepClone(newConfig),
      isDirty: false,
    });
  },
}));
