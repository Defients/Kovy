import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProfilesEngine, NULL_PROFILES_OUTPUT, createDefaultProfiles } from "@/engine/profilesEngine";
import type { ProfilesConfig } from "@/store/types";

describe("ProfilesEngine", () => {
  let store: Record<string, string>;
  let engine: ProfilesEngine;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
    engine = new ProfilesEngine();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with no profiles", () => {
    expect(engine.getProfile("any")).toBeNull();
  });

  it("NULL_PROFILES_OUTPUT has correct defaults", () => {
    expect(NULL_PROFILES_OUTPUT.savedProfiles).toEqual([]);
    expect(NULL_PROFILES_OUTPUT.activeProfileId).toBeNull();
  });

  it("saveProfile adds a profile and persists", () => {
    const profile = engine.saveProfile("Test", "🐾", {} as any);
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe("Test");
    expect(profile.icon).toBe("🐾");
    expect(engine.getProfile(profile.id)).not.toBeNull();
    const raw = store["kovy-saved-profiles"];
    expect(raw).toBeDefined();
  });

  it("deleteProfile removes a profile", () => {
    const p = engine.saveProfile("Test", "🐾", {} as any);
    engine.deleteProfile(p.id);
    expect(engine.getProfile(p.id)).toBeNull();
  });

  it("deleteProfile clears activeProfileId if active", () => {
    const p = engine.saveProfile("Test", "🐾", {} as any);
    engine.setActiveProfile(p.id);
    engine.deleteProfile(p.id);
    const out = engine.update({ savedProfiles: [], activeProfileId: p.id, hotkeySwap: false, autoSwitchRules: [] });
    expect(out.activeProfileId).toBeNull();
  });

  it("setActiveProfile sets and persists", () => {
    const p = engine.saveProfile("Test", "🐾", {} as any);
    engine.setActiveProfile(p.id);
    const raw = store["kovy-saved-profiles"];
    const parsed = JSON.parse(raw);
    expect(parsed.activeProfileId).toBe(p.id);
  });

  it("cycleNext cycles through profiles", () => {
    const p1 = engine.saveProfile("A", "🐾", {} as any);
    const p2 = engine.saveProfile("B", "🎯", {} as any);
    engine.setActiveProfile(p1.id);
    const next = engine.cycleNext();
    expect(next?.id).toBe(p2.id);
    const next2 = engine.cycleNext();
    expect(next2?.id).toBe(p1.id);
  });

  it("cycleNext returns null when no profiles", () => {
    expect(engine.cycleNext()).toBeNull();
  });

  it("seedDefaultProfiles creates 6 default profiles", () => {
    engine.seedDefaultProfiles();
    const out = engine.update({ savedProfiles: [], activeProfileId: null, hotkeySwap: false, autoSwitchRules: [] });
    expect(out.savedProfiles.length).toBe(6);
    expect(out.activeProfileId).not.toBeNull();
  });

  it("seedDefaultProfiles does not overwrite existing profiles", () => {
    engine.saveProfile("Custom", "🐾", {} as any);
    engine.seedDefaultProfiles();
    const out = engine.update({ savedProfiles: [], activeProfileId: null, hotkeySwap: false, autoSwitchRules: [] });
    expect(out.savedProfiles.length).toBe(1);
    expect(out.savedProfiles[0].name).toBe("Custom");
  });

  it("update does not wipe seeded profiles when config is empty", () => {
    engine.seedDefaultProfiles();
    const emptyConfig: ProfilesConfig = { savedProfiles: [], activeProfileId: null, hotkeySwap: false, autoSwitchRules: [] };
    const out = engine.update(emptyConfig);
    expect(out.savedProfiles.length).toBe(6);
  });

  it("update syncs from config when engine has no profiles", () => {
    const config: ProfilesConfig = {
      savedProfiles: [{ id: "x", name: "X", icon: "🐾", timestamp: 0, config: {} as any }],
      activeProfileId: "x",
      hotkeySwap: false,
      autoSwitchRules: [],
    };
    const out = engine.update(config);
    expect(out.savedProfiles.length).toBe(1);
    expect(out.savedProfiles[0].name).toBe("X");
  });

  it("persists and loads on reconstruction", () => {
    engine.saveProfile("Persist", "🐾", {} as any);
    const engine2 = new ProfilesEngine();
    const out = engine2.update({ savedProfiles: [], activeProfileId: null, hotkeySwap: false, autoSwitchRules: [] });
    expect(out.savedProfiles.length).toBe(1);
    expect(out.savedProfiles[0].name).toBe("Persist");
  });

  it("createDefaultProfiles returns 6 profiles with unique IDs", () => {
    const defaults = createDefaultProfiles();
    expect(defaults.length).toBe(6);
    const ids = defaults.map(p => p.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("createDefaultProfiles has expected names", () => {
    const defaults = createDefaultProfiles();
    const names = defaults.map(p => p.name);
    expect(names).toContain("Default");
    expect(names).toContain("Focus");
    expect(names).toContain("Streaming");
    expect(names).toContain("Gaming");
    expect(names).toContain("Low Power");
    expect(names).toContain("Cozy");
  });

  // --- v8.1 regression: autoSwitchRules must survive update/import cycles ---

  it("update preserves autoSwitchRules in config when engine syncs from config", () => {
    const rules = [
      { id: "rule1", type: "time" as const, condition: "09:00", profileId: "x", enabled: true },
    ];
    const config: ProfilesConfig = {
      savedProfiles: [{ id: "x", name: "X", icon: "🐾", timestamp: 0, config: {} as any }],
      activeProfileId: "x",
      hotkeySwap: false,
      autoSwitchRules: rules,
    };
    const out = engine.update(config);
    // The engine output doesn't include rules, but the config should still have them
    // This test verifies the engine doesn't throw and the profile sync works
    expect(out.savedProfiles.length).toBe(1);
    expect(out.activeProfileId).toBe("x");
    // Verify rules are still in the original config object (not mutated)
    expect(config.autoSwitchRules).toEqual(rules);
  });

  it("update syncs activeProfileId from config when auto-switch runner changes it", () => {
    engine.seedDefaultProfiles();
    const defaults = engine.update({ savedProfiles: [], activeProfileId: null, hotkeySwap: false, autoSwitchRules: [] });
    const focusId = defaults.savedProfiles.find(p => p.name === "Focus")?.id;
    expect(focusId).toBeDefined();

    // Simulate auto-switch runner updating activeProfileId in config
    const configWithNewActive: ProfilesConfig = {
      savedProfiles: [],
      activeProfileId: focusId!,
      hotkeySwap: false,
      autoSwitchRules: [],
    };
    const out = engine.update(configWithNewActive);
    expect(out.activeProfileId).toBe(focusId);
  });

  it("update does not change activeProfileId to a non-existent profile", () => {
    engine.seedDefaultProfiles();
    const out = engine.update({
      savedProfiles: [],
      activeProfileId: "non-existent-id",
      hotkeySwap: false,
      autoSwitchRules: [],
    });
    // Should keep the original active profile, not switch to a non-existent one
    expect(out.activeProfileId).not.toBe("non-existent-id");
  });
});
