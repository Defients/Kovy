import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deepMerge, validateConfig, safeImportConfig, clampConfig, getConfigBackup } from "../store/configValidation";
import { DEFAULT_CONFIG } from "../store/defaults";
import { CONFIG_VERSION } from "../store/types";

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const target = { a: 1, b: 2, c: 3 };
    const source = { b: 20, c: 30 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 20, c: 30 });
  });

  it("merges nested objects recursively", () => {
    const target = { outer: { a: 1, b: 2, inner: { x: 10 } } };
    const source = { outer: { b: 20, inner: { y: 99 } } };
    const result = deepMerge(target, source as any);
    expect(result.outer.a).toBe(1);
    expect(result.outer.b).toBe(20);
    expect((result.outer.inner as any).x).toBe(10);
    expect((result.outer.inner as any).y).toBe(99);
  });

  it("preserves target keys missing from source", () => {
    const target = { a: 1, b: 2 };
    const source = { a: 10 };
    const result = deepMerge(target, source);
    expect(result.b).toBe(2);
  });

  it("does not merge arrays — replaces them", () => {
    const target = { items: [1, 2, 3] } as Record<string, unknown>;
    const source = { items: [4, 5] };
    const result = deepMerge(target, source);
    expect(result.items).toEqual([4, 5]);
  });

  it("handles empty source", () => {
    const target = { a: 1 };
    const result = deepMerge(target, {});
    expect(result).toEqual({ a: 1 });
  });
});

describe("validateConfig", () => {
  it("validates a correct config", () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object input", () => {
    const result = validateConfig("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config is not an object");
  });

  it("rejects null input", () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
  });

  it("rejects missing version", () => {
    const result = validateConfig({ general: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("version"))).toBe(true);
  });

  it("rejects future version", () => {
    const result = validateConfig({ version: CONFIG_VERSION + 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("newer than"))).toBe(true);
  });

  it("reports missing sections", () => {
    const result = validateConfig({ version: CONFIG_VERSION });
    expect(result.errors.some(e => e.includes("general"))).toBe(true);
    expect(result.errors.some(e => e.includes("appearance"))).toBe(true);
  });

  it("reports out-of-range values", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.appearance.size = 100;
    const result = validateConfig(cfg);
    expect(result.errors.some(e => e.includes("size"))).toBe(true);
  });
});

describe("clampConfig", () => {
  it("clamps out-of-range values to valid ranges", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.appearance.size = 10;
    cfg.appearance.opacity = -5;
    cfg.vision.analysisFps = 100;
    cfg.mood.playfulnessBias = 5;

    const clamped = clampConfig(cfg);
    expect(clamped.appearance.size).toBe(3.0);
    expect(clamped.appearance.opacity).toBe(0.1);
    expect(clamped.vision.analysisFps).toBe(15);
    expect(clamped.mood.playfulnessBias).toBe(1);
  });

  it("preserves valid values", () => {
    const clamped = clampConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    expect(clamped.appearance.size).toBe(DEFAULT_CONFIG.appearance.size);
    expect(clamped.vision.analysisFps).toBe(DEFAULT_CONFIG.vision.analysisFps);
  });

  it("clamps renderFpsCap to nearest valid value", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.appearance.renderFpsCap = 45;
    const clamped = clampConfig(cfg);
    // Should snap to nearest: 30 or 60
    expect([15, 30, 60, 120]).toContain(clamped.appearance.renderFpsCap);
  });
});

describe("safeImportConfig", () => {
  it("accepts a valid config and returns it", () => {
    const result = safeImportConfig(DEFAULT_CONFIG);
    expect(result.config).not.toBeNull();
    expect(result.config!.version).toBe(CONFIG_VERSION);
  });

  it("fills missing nested keys from defaults", () => {
    const partial = {
      version: CONFIG_VERSION,
      general: { launchAtStartup: true },
    };
    const result = safeImportConfig(partial);
    expect(result.config).not.toBeNull();
    // Should have all general keys filled
    expect(result.config!.general.startMinimized).toBe(DEFAULT_CONFIG.general.startMinimized);
    // Should have all other sections from defaults
    expect(result.config!.appearance.size).toBe(DEFAULT_CONFIG.appearance.size);
    // But the specified value should be preserved
    expect(result.config!.general.launchAtStartup).toBe(true);
  });

  it("rejects completely invalid input", () => {
    const result = safeImportConfig("garbage");
    expect(result.config).toBeNull();
  });

  it("rejects future version configs", () => {
    const result = safeImportConfig({ version: CONFIG_VERSION + 10 });
    expect(result.config).toBeNull();
    expect(result.errors.some(e => e.includes("newer"))).toBe(true);
  });

  it("clamps out-of-range values during import", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.appearance.size = 999;
    const result = safeImportConfig(cfg);
    expect(result.config).not.toBeNull();
    expect(result.config!.appearance.size).toBe(3.0);
  });
});

describe("v3 to v4 migration", () => {
  function makeV3Config(): Record<string, unknown> {
    // Simulate a v3 config (no memory, family, muse sections)
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.version = 3;
    delete cfg.memory;
    delete cfg.family;
    delete cfg.muse;
    delete (cfg.hotkeys as Record<string, unknown>).toggleMuse;
    return cfg;
  }

  it("migrates v3 config to v4 with memory section", () => {
    const v3 = makeV3Config();
    const result = safeImportConfig(v3);
    expect(result.config).not.toBeNull();
    expect(result.config!.version).toBe(CONFIG_VERSION);
    expect(result.migrated).toBe(true);
    expect(result.config!.memory).toBeDefined();
    expect(result.config!.memory.enabled).toBe(true);
    expect(result.config!.memory.maxMemories).toBe(2000);
    expect(result.config!.memory.retentionDays).toBe(90);
    expect(result.config!.memory.storeWindowTitles).toBe(false);
  });

  it("migrates v3 config to v4 with family section", () => {
    const v3 = makeV3Config();
    const result = safeImportConfig(v3);
    expect(result.config).not.toBeNull();
    expect(result.config!.family).toBeDefined();
    expect(result.config!.family.maxEntities).toBe(1);
    expect(result.config!.family.dynamics).toBeDefined();
    expect(result.config!.family.dynamics.curiosityContagion).toBe(0.5);
  });

  it("migrates v3 config to v4 with muse section", () => {
    const v3 = makeV3Config();
    const result = safeImportConfig(v3);
    expect(result.config).not.toBeNull();
    expect(result.config!.muse).toBeDefined();
    expect(result.config!.muse.enabled).toBe(false);
    expect(result.config!.muse.hotkey).toBe("Alt+Shift+M");
  });

  it("adds toggleMuse hotkey during migration", () => {
    const v3 = makeV3Config();
    const result = safeImportConfig(v3);
    expect(result.config).not.toBeNull();
    expect(result.config!.hotkeys.toggleMuse).toBe("Alt+Shift+M");
  });

  it("preserves existing v3 settings during migration", () => {
    const v3 = makeV3Config();
    v3.general = { ...(v3.general as Record<string, unknown>), launchAtStartup: true };
    v3.appearance = { ...(v3.appearance as Record<string, unknown>), size: 1.5 };
    const result = safeImportConfig(v3);
    expect(result.config).not.toBeNull();
    expect(result.config!.general.launchAtStartup).toBe(true);
    expect(result.config!.appearance.size).toBe(1.5);
  });

  it("clamps memory config values", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.memory.maxMemories = 99999;
    cfg.memory.retentionDays = 0;
    cfg.memory.significanceThreshold = 5;
    const result = safeImportConfig(cfg);
    expect(result.config).not.toBeNull();
    expect(result.config!.memory.maxMemories).toBe(5000);
    expect(result.config!.memory.retentionDays).toBe(7);
    expect(result.config!.memory.significanceThreshold).toBe(1);
  });

  it("clamps family config values", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.family.maxEntities = 100;
    const result = safeImportConfig(cfg);
    expect(result.config).not.toBeNull();
    expect(result.config!.family.maxEntities).toBe(11);
  });

  it("clamps muse config values", () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cfg.muse.maxOverlays = 100;
    cfg.muse.overlayLifetime = 0;
    const result = safeImportConfig(cfg);
    expect(result.config).not.toBeNull();
    expect(result.config!.muse.maxOverlays).toBe(12);
    expect(result.config!.muse.overlayLifetime).toBe(2);
  });

  it("does not re-migrate already v4 config", () => {
    const result = safeImportConfig(DEFAULT_CONFIG);
    expect(result.config).not.toBeNull();
    expect(result.migrated).toBe(false);
  });

  // --- v8.1 regression: config backup before migration ---
  describe("config backup before migration", () => {
    const store: Record<string, string> = {};

    beforeEach(() => {
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const k of Object.keys(store)) delete store[k];
    });

    it("saves a backup to localStorage before migrating an old config", () => {
      const oldConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      oldConfig.version = 1; // Force migration
      safeImportConfig(oldConfig);
      const backupRaw = localStorage.getItem("kovy-config-backup");
      expect(backupRaw).not.toBeNull();
      const backup = JSON.parse(backupRaw!);
      expect(backup.version).toBe(1);
      expect(backup.config).toBeDefined();
      expect(typeof backup.savedAt).toBe("number");
    });

    it("does not save a backup when config is already at current version", () => {
      safeImportConfig(DEFAULT_CONFIG);
      expect(localStorage.getItem("kovy-config-backup")).toBeNull();
    });

    it("getConfigBackup returns null when no backup exists", () => {
      expect(getConfigBackup()).toBeNull();
    });

    it("getConfigBackup returns the saved backup", () => {
      const oldConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      oldConfig.version = 1;
      safeImportConfig(oldConfig);
      const backup = getConfigBackup();
      expect(backup).not.toBeNull();
      expect(backup!.version).toBe(1);
    });
  });
});
