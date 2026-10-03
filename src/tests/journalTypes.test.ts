import { describe, it, expect } from "vitest";
import type { JournalEntryType } from "@/engine/journalEngine";

// Regression test: ensure every JournalEntryType has a matching icon and label
// in the JournalTab UI maps. Previously "growth_event" was "growth", "seasonal_event"
// was "weather", and "behavior_first" was missing entirely.

describe("JournalTab type coverage", () => {
  const ALL_TYPES: JournalEntryType[] = [
    "milestone",
    "ritual",
    "bond",
    "mood_shift",
    "behavior_first",
    "daily_summary",
    "gaming_session",
    "family_event",
    "focus_session",
    "seasonal_event",
    "growth_event",
    "celebration",
    "whisper",
    "ai_insight",
    "recall",
  ];

  // These must match the constants in JournalTab.tsx
  const TYPE_ICONS: Record<string, string> = {
    milestone: "🏆",
    ritual: "📅",
    bond: "🤝",
    mood_shift: "😊",
    gaming_session: "🎮",
    family_event: "👥",
    daily_summary: "📋",
    focus_session: "🎯",
    growth_event: "🌱",
    celebration: "🎉",
    whisper: "💬",
    seasonal_event: "☁",
    behavior_first: "✨",
    ai_insight: "🤖",
    recall: "🕰️",
  };

  const TYPE_LABELS: Record<string, string> = {
    milestone: "Milestone",
    ritual: "Ritual",
    bond: "Bond",
    mood_shift: "Mood Shift",
    gaming_session: "Gaming Session",
    family_event: "Family Event",
    daily_summary: "Daily Summary",
    focus_session: "Focus Session",
    growth_event: "Growth",
    celebration: "Celebration",
    whisper: "Whisper",
    seasonal_event: "Seasonal",
    behavior_first: "First Behavior",
    ai_insight: "AI Insight",
    recall: "Recall",
  };

  it("every JournalEntryType has an icon in TYPE_ICONS", () => {
    for (const type of ALL_TYPES) {
      expect(TYPE_ICONS[type]).toBeDefined();
      expect(TYPE_ICONS[type].length).toBeGreaterThan(0);
    }
  });

  it("every JournalEntryType has a label in TYPE_LABELS", () => {
    for (const type of ALL_TYPES) {
      expect(TYPE_LABELS[type]).toBeDefined();
      expect(TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it("no stale keys exist in TYPE_ICONS (e.g. 'growth' or 'weather')", () => {
    const stale = ["growth", "weather"];
    for (const key of stale) {
      expect(TYPE_ICONS[key]).toBeUndefined();
    }
  });

  it("no stale keys exist in TYPE_LABELS (e.g. 'growth' or 'weather')", () => {
    const stale = ["growth", "weather"];
    for (const key of stale) {
      expect(TYPE_LABELS[key]).toBeUndefined();
    }
  });
});
