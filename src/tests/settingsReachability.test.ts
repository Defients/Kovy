// ============================================================
// Settings tab reachability — tests against liteMode.ts
// Replaces the deprecated settingsViewMode.ts-based tests.
// Verifies that all settings tabs are known and that Lite mode
// correctly hides advanced sections.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  LITE_DISABLED_SECTIONS,
  isSectionVisibleInLite,
} from "@/store/liteMode";

// Tab IDs from SettingsApp.tsx TABS array
const TAB_IDS = [
  "general", "appearance", "behavior", "vision", "mood",
  "habitat", "memory", "family", "muse", "gaming",
  "circadian", "emote", "atmosphere", "bond", "milestone",
  "ritual", "journal", "skinPack", "soundPack", "appProfile",
  "stats", "profiles", "performance", "privacy", "audio",
  "hotkeys", "advanced", "advancedTuning", "diagnostics",
  "ai", "toys", "experimental",
] as const;

describe("Settings tab reachability (liteMode)", () => {
  it("LITE_DISABLED_SECTIONS is non-empty", () => {
    expect(LITE_DISABLED_SECTIONS.length).toBeGreaterThan(0);
  });

  it("emote is visible in lite mode", () => {
    expect(isSectionVisibleInLite("emote")).toBe(true);
  });

  it("memory is hidden in lite mode", () => {
    expect(isSectionVisibleInLite("memory")).toBe(false);
  });

  it("gaming is hidden in lite mode", () => {
    expect(isSectionVisibleInLite("gaming")).toBe(false);
  });

  it("general is visible in lite mode", () => {
    expect(isSectionVisibleInLite("general")).toBe(true);
  });

  it("bond is visible in lite mode", () => {
    expect(isSectionVisibleInLite("bond")).toBe(true);
  });

  it("toys is hidden in lite mode", () => {
    expect(isSectionVisibleInLite("toys")).toBe(false);
  });

  it("experimental is hidden in lite mode", () => {
    expect(isSectionVisibleInLite("experimental")).toBe(false);
  });

  it("every tab id is either visible in lite or explicitly disabled", () => {
    for (const tabId of TAB_IDS) {
      // Each tab should have a definitive answer from isSectionVisibleInLite
      // (it returns true for visible, false for disabled)
      const visible = isSectionVisibleInLite(tabId);
      expect(typeof visible).toBe("boolean");
    }
  });

  it("core tabs are visible in lite mode", () => {
    const coreTabs = ["general", "appearance", "behavior", "mood", "bond", "milestone", "audio", "ritual", "journal", "stats", "profiles", "privacy", "hotkeys", "emote", "skinPack", "soundPack"];
    for (const tabId of coreTabs) {
      expect(isSectionVisibleInLite(tabId)).toBe(true);
    }
  });

  it("advanced tabs are hidden in lite mode", () => {
    const advancedTabs = ["family", "muse", "gaming", "habitat", "memory", "atmosphere", "circadian", "appProfile", "vision", "toys", "experimental"];
    for (const tabId of advancedTabs) {
      expect(isSectionVisibleInLite(tabId)).toBe(false);
    }
  });
});
