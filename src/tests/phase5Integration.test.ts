import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_MUSE, DEFAULT_MEMORY, DEFAULT_FAMILY } from "../store/defaults";
import { CONFIG_VERSION } from "../store/types";
import { KOVY_VERSION } from "../lib/version";
import {
  exportDiagnosticsBundle,
  setDiagnosticsEnabled,
  clearDiagnostics,
  recordBehaviorChange,
  recordMoodChange,
  recordEntityCount,
  type SystemSummary,
} from "../engine/diagnosticsEngine";
import { useEntityStore, FOUNDER_ID } from "../store/entityStore";
import { safeImportConfig, deepMerge } from "../store/configValidation";

// --- Diagnostics export integration ---

describe("Diagnostics export — system summary", () => {
  beforeEach(() => {
    setDiagnosticsEnabled(true);
    clearDiagnostics();
  });

  it("includes systemSummary when provided", () => {
    const summary: SystemSummary = {
      entityCount: 3,
      memoryEnabled: true,
      museActive: true,
      museMode: "code",
      museOverlayCount: 4,
      gamingActive: true,
    };
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG, summary);
    const bundle = JSON.parse(json);
    expect(bundle.systemSummary).toBeDefined();
    expect(bundle.systemSummary.entityCount).toBe(3);
    expect(bundle.systemSummary.memoryEnabled).toBe(true);
    expect(bundle.systemSummary.museActive).toBe(true);
    expect(bundle.systemSummary.museMode).toBe("code");
    expect(bundle.systemSummary.museOverlayCount).toBe(4);
  });

  it("omits systemSummary when not provided", () => {
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    expect(bundle.systemSummary).toBeUndefined();
  });

  it("diagnostics export reports current version", () => {
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    expect(bundle.kovyVersion).toBe(KOVY_VERSION);
  });
});

describe("Diagnostics export — privacy safety", () => {
  beforeEach(() => {
    setDiagnosticsEnabled(true);
    clearDiagnostics();
  });

  it("behavior entries contain entityId but no window titles or app names", () => {
    recordBehaviorChange("idle_float", "wander");
    recordBehaviorChange("idle_float", "inspect", "kovy-sibling-1");
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    const behaviorEntries = bundle.diagnosticEntries.filter(
      (e: any) => e.type === "behavior"
    );
    expect(behaviorEntries.length).toBeGreaterThan(0);
    for (const entry of behaviorEntries) {
      expect(entry.data.entityId).toBeDefined();
      // Ensure no window title or app name fields leaked
      expect(entry.data.windowTitle).toBeUndefined();
      expect(entry.data.appName).toBeUndefined();
      expect(entry.data.processName).toBeUndefined();
    }
  });

  it("mood entries contain entityId but no sensitive data", () => {
    recordMoodChange("curious");
    recordMoodChange("playful", "kovy-sibling-2");
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    const moodEntries = bundle.diagnosticEntries.filter(
      (e: any) => e.type === "mood"
    );
    expect(moodEntries.length).toBeGreaterThan(0);
    for (const entry of moodEntries) {
      expect(entry.data.entityId).toBeDefined();
      expect(entry.data.windowTitle).toBeUndefined();
      expect(entry.data.processName).toBeUndefined();
    }
  });

  it("entity_count entries have count only", () => {
    recordEntityCount(3);
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    const countEntries = bundle.diagnosticEntries.filter(
      (e: any) => e.type === "entity_count"
    );
    expect(countEntries.length).toBe(1);
    expect(countEntries[0].data.count).toBe(3);
    expect(Object.keys(countEntries[0].data)).toEqual(["count"]);
  });
});

// --- Founding Kovy initialization ---

describe("Founding Kovy initialization", () => {
  beforeEach(() => {
    useEntityStore.getState().resetAll();
  });

  it("initFounder creates the founding entity with correct ID", () => {
    useEntityStore.getState().initFounder();
    expect(useEntityStore.getState().hasEntity(FOUNDER_ID)).toBe(true);
    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder).toBeDefined();
    expect(founder!.meta.id).toBe(FOUNDER_ID);
    expect(founder!.meta.name).toBe("Kovy");
    expect(founder!.meta.isFounder).toBe(true);
  });

  it("initFounder is idempotent — calling twice does not duplicate", () => {
    useEntityStore.getState().initFounder();
    useEntityStore.getState().initFounder();
    const all = useEntityStore.getState().getAllEntities();
    const founders = all.filter((e) => e.meta.isFounder);
    expect(founders.length).toBe(1);
  });

  it("founding entity has default runtime position", () => {
    useEntityStore.getState().initFounder();
    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.position).toEqual({ x: 200, y: 200 });
  });
});

// --- Config completeness ---

describe("DEFAULT_CONFIG completeness", () => {
  it("has a valid CONFIG_VERSION", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
    expect(CONFIG_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG_VERSION)).toBe(true);
  });

  it("contains all 56 config fields", () => {
    const keys = Object.keys(DEFAULT_CONFIG);
    expect(keys.length).toBe(56);
    expect(keys).toContain("version");
    expect(keys).toContain("general");
    expect(keys).toContain("appearance");
    expect(keys).toContain("behavior");
    expect(keys).toContain("vision");
    expect(keys).toContain("mood");
    expect(keys).toContain("performance");
    expect(keys).toContain("privacy");
    expect(keys).toContain("audio");
    expect(keys).toContain("hotkeys");
    expect(keys).toContain("advanced");
    expect(keys).toContain("habitat");
    expect(keys).toContain("memory");
    expect(keys).toContain("family");
    expect(keys).toContain("muse");
    expect(keys).toContain("gaming");
    expect(keys).toContain("circadian");
    expect(keys).toContain("emote");
    expect(keys).toContain("atmosphere");
    expect(keys).toContain("bond");
    expect(keys).toContain("milestone");
    expect(keys).toContain("ritual");
    expect(keys).toContain("journal");
    expect(keys).toContain("weather");
    expect(keys).toContain("skinPack");
    expect(keys).toContain("soundPack");
    expect(keys).toContain("familyScenes");
    expect(keys).toContain("appProfile");
    expect(keys).toContain("habitatObjects");
    expect(keys).toContain("audioReactivity");
    expect(keys).toContain("thought");
    expect(keys).toContain("seasonal");
    expect(keys).toContain("growth");
    expect(keys).toContain("stats");
    expect(keys).toContain("focus");
    expect(keys).toContain("idle");
    expect(keys).toContain("personalityEvolution");
    expect(keys).toContain("celebration");
    expect(keys).toContain("ambientSound");
    expect(keys).toContain("whisper");
    expect(keys).toContain("entityRelations");
    expect(keys).toContain("drag");
    expect(keys).toContain("profiles");
    expect(keys).toContain("dream");
    expect(keys).toContain("shadowConfig");
    expect(keys).toContain("onboardingComplete");
    expect(keys).toContain("focusTarget");
    expect(keys).toContain("ai");
    expect(keys).toContain("toys");
    expect(keys).toContain("experimental");
    expect(keys).toContain("digest");
    expect(keys).toContain("chronicle");
    expect(keys).toContain("intent");
    expect(keys).toContain("story");
    expect(keys).toContain("recall");
    expect(keys).toContain("chat");
  });

  it("memory defaults are safe", () => {
    expect(DEFAULT_MEMORY.enabled).toBe(true);
    expect(DEFAULT_MEMORY.maxMemories).toBe(2000);
    expect(DEFAULT_MEMORY.retentionDays).toBe(90);
    expect(DEFAULT_MEMORY.storeWindowTitles).toBe(false);
    expect(DEFAULT_MEMORY.significanceThreshold).toBe(0.3);
  });

  it("family defaults start with 1 entity", () => {
    expect(DEFAULT_FAMILY.maxEntities).toBe(1);
    expect(DEFAULT_FAMILY.dynamics).toBeDefined();
    expect(DEFAULT_FAMILY.showFamilyNames).toBe(false);
  });

  it("muse defaults are disabled", () => {
    expect(DEFAULT_MUSE.enabled).toBe(false);
    expect(DEFAULT_MUSE.hotkey).toBe("Alt+Shift+M");
    expect(DEFAULT_MUSE.maxOverlays).toBe(6);
    expect(DEFAULT_MUSE.style).toBe("subtle");
  });

  it("hotkeys include toggleMuse", () => {
    expect(DEFAULT_CONFIG.hotkeys.toggleMuse).toBe("Alt+Shift+M");
  });
});

// --- Migration edge cases ---

describe("Migration edge cases", () => {
  it("v1 config migrates all the way to v4 with all sections", () => {
    const v1: Record<string, unknown> = {
      version: 1,
      general: { launchAtStartup: false },
      appearance: { size: 1.0 },
      behavior: { curiosityStrength: 0.6 },
      vision: { enabled: true },
      mood: { enabled: true },
      performance: { preset: "balanced" },
      privacy: { sensitiveApps: [] },
      audio: { volume: 0.5 },
      hotkeys: { toggleVisibility: "Alt+Shift+K" },
      advanced: { debugMode: false },
    };
    const result = safeImportConfig(v1);
    expect(result.config).not.toBeNull();
    expect(result.migrated).toBe(true);
    expect(result.config!.version).toBe(CONFIG_VERSION);
    // All new sections should be present
    expect(result.config!.habitat).toBeDefined();
    expect(result.config!.memory).toBeDefined();
    expect(result.config!.family).toBeDefined();
    expect(result.config!.muse).toBeDefined();
    expect(result.config!.bond).toBeDefined();
    expect(result.config!.milestone).toBeDefined();
    expect(result.config!.hotkeys.toggleMuse).toBeDefined();
  });

  it("config with partial memory section gets defaults merged in", () => {
    const partial: Record<string, unknown> = {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      memory: { enabled: false },
    };
    const result = safeImportConfig(partial);
    expect(result.config).not.toBeNull();
    // enabled was explicitly set to false — should be preserved
    expect(result.config!.memory.enabled).toBe(false);
    // Other fields should come from defaults
    expect(result.config!.memory.maxMemories).toBe(2000);
    expect(result.config!.memory.retentionDays).toBe(90);
  });

  it("deep merge preserves nested family dynamics", () => {
    const target = {
      family: {
        maxEntities: 1,
        dynamics: { curiosityContagion: 0.5, comfortInfluence: 0.5 },
      },
    };
    const source = {
      family: {
        maxEntities: 3,
        dynamics: { curiosityContagion: 0.8 },
      },
    };
    const result = deepMerge(target as any, source as any);
    expect(result.family.maxEntities).toBe(3);
    expect(result.family.dynamics.curiosityContagion).toBe(0.8);
    expect(result.family.dynamics.comfortInfluence).toBe(0.5);
  });
});

// --- Version consistency ---

describe("Version consistency", () => {
  it("CONFIG_VERSION matches DEFAULT_CONFIG.version", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
  });

  it("diagnostics export reports current version", () => {
    setDiagnosticsEnabled(true);
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const bundle = JSON.parse(json);
    expect(bundle.kovyVersion).toBe(KOVY_VERSION);
  });
});
