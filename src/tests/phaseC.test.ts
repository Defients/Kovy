// ============================================================
// State Card, App Profile Tests
// (Settings View Mode tests removed — settingsViewMode.ts retired
//  in v9.0; Lite/Full mode is now tested via settingsReachability.test.ts)
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateStateCardText,
  generateStateCardMarkdown,
  generateStateCardJSON,
  type StateCardData,
} from "@/lib/stateCard";
import {
  AppProfileEngine,
  BUILTIN_APP_PROFILES,
  createDefaultAppProfilesState,
  type AppProfile,
} from "@/engine/appProfileEngine";

// --- State Card Tests ---

describe("State Card Export", () => {
  const mockData: StateCardData = {
    kovyName: "Kovy",
    bondLevel: "friend",
    totalInteractions: 42,
    streakDays: 7,
    milestonesUnlocked: 15,
    totalMilestones: 30,
    surfaceMood: "calm",
    behaviorState: "idle_float",
    activeTimeHours: 12.5,
    familyMembers: 2,
    ritualsPerformed: 5,
    journalEntries: 30,
    kovyVersion: "7.0.2",
    exportDate: new Date("2026-07-03").toISOString(),
  };

  it("generateStateCardText produces box-drawing text", () => {
    const text = generateStateCardText(mockData);
    expect(text).toContain("Kovy");
    expect(text).toContain("╔");
    expect(text).toContain("Bond");
    expect(text).toContain("calm");
  });

  it("generateStateCardMarkdown produces markdown table", () => {
    const md = generateStateCardMarkdown(mockData);
    expect(md).toContain("## Kovy");
    expect(md).toContain("| Bond |");
    expect(md).toContain("| Mood |");
  });

  it("generateStateCardJSON produces valid JSON", () => {
    const json = generateStateCardJSON(mockData);
    const parsed = JSON.parse(json);
    expect(parsed.kovyName).toBe("Kovy");
    expect(parsed.bondLevel).toBe("friend");
  });

  it("handles null bond level", () => {
    const data = { ...mockData, bondLevel: null };
    const text = generateStateCardText(data);
    expect(text).toContain("Kovy");
    const md = generateStateCardMarkdown(data);
    expect(md).toContain("—");
  });
});

// --- App Profile Tests ---

describe("App Profile Engine", () => {
  let engine: AppProfileEngine;

  beforeEach(() => {
    engine = new AppProfileEngine();
  });

  it("starts with no profiles", () => {
    expect(engine.getProfiles()).toHaveLength(0);
    expect(engine.getActiveProfile()).toBeNull();
  });

  it("has 5 built-in profiles", () => {
    expect(BUILTIN_APP_PROFILES).toHaveLength(5);
  });

  it("addProfile adds a profile", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    expect(engine.getProfiles()).toHaveLength(1);
  });

  it("removeProfile removes by id", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    expect(engine.removeProfile(BUILTIN_APP_PROFILES[0].id)).toBe(true);
    expect(engine.getProfiles()).toHaveLength(0);
  });

  it("removeProfile returns false for unknown id", () => {
    expect(engine.removeProfile("nonexistent")).toBe(false);
  });

  it("updateProfile updates fields", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    expect(engine.updateProfile(BUILTIN_APP_PROFILES[0].id, { enabled: false })).toBe(true);
    expect(engine.getProfiles()[0].enabled).toBe(false);
  });

  it("matchApp matches by pattern", () => {
    engine.addProfile({
      id: "test",
      name: "Test",
      icon: "🎮",
      matchType: "exe",
      matchPattern: "steam",
      overrides: {},
      enabled: true,
    });
    const match = engine.matchApp("steam.exe");
    expect(match).not.toBeNull();
    expect(match!.id).toBe("test");
  });

  it("matchApp is case-insensitive", () => {
    engine.addProfile({
      id: "test",
      name: "Test",
      icon: "🎮",
      matchType: "exe",
      matchPattern: "steam",
      overrides: {},
      enabled: true,
    });
    const match = engine.matchApp("STEAM.EXE");
    expect(match).not.toBeNull();
  });

  it("matchApp returns null for no match", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    expect(engine.matchApp("notepad.exe")).toBeNull();
  });

  it("matchApp skips disabled profiles", () => {
    engine.addProfile({
      id: "test",
      name: "Test",
      icon: "🎮",
      matchType: "exe",
      matchPattern: "steam",
      overrides: {},
      enabled: false,
    });
    expect(engine.matchApp("steam.exe")).toBeNull();
  });

  it("setActiveApp sets active profile", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    engine.setActiveApp("game_launcher.exe");
    expect(engine.getActiveProfile()).not.toBeNull();
  });

  it("setActiveApp clears active when no match", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    engine.setActiveApp("game.exe");
    engine.setActiveApp("notepad.exe");
    expect(engine.getActiveProfile()).toBeNull();
  });

  it("getActiveOverrides returns null when no active profile", () => {
    expect(engine.getActiveOverrides()).toBeNull();
  });

  it("applyOverrides returns unchanged config when no active profile", () => {
    const config = { appearance: { opacity: 1 } } as any;
    const result = engine.applyOverrides(config);
    expect(result).toBe(config);
  });

  it("reset clears all profiles", () => {
    engine.addProfile({ ...BUILTIN_APP_PROFILES[0] });
    engine.reset();
    expect(engine.getProfiles()).toHaveLength(0);
  });

  it("createDefaultAppProfilesState returns empty state", () => {
    const state = createDefaultAppProfilesState();
    expect(state.profiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
  });
});
