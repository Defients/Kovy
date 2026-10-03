// ============================================================
// Story Engine tests — v9.0
// Verifies weekly chapter generation, section building, storage,
// and scheduling logic.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  StoryEngine,
  loadStoryChapters,
  persistStoryChapter,
  clearStoryChapters,
  type StoryChapter,
  type StoryInputs,
} from "@/engine/storyEngine";
import type { StoryConfig, SurfaceMood, BondLevel } from "@/store/types";
import type { ChronicleSnapshot } from "@/engine/chronicleEngine";

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const baseConfig: StoryConfig = {
  enabled: true,
  weekday: 0, // Sunday
  hour: 20,   // 8 PM
  retentionWeeks: 26,
  autoDismissSec: 15,
  aiPolish: false,
};

function makeSnapshot(overrides: Partial<ChronicleSnapshot> = {}): ChronicleSnapshot {
  return {
    dateStr: "2026-01-01",
    timestamp: Date.now(),
    bondPoints: 100,
    bondLevel: "friend" as BondLevel,
    surfaceMood: "calm" as SurfaceMood,
    growthStage: null,
    focusMinutes: 60,
    gamingSessions: 0,
    emotes: 5,
    thoughts: 10,
    whispers: 2,
    milestoneCount: 1,
    activeSeconds: 3600,
    highlightTitle: null,
    ...overrides,
  };
}

const baseInputs: StoryInputs = {
  snapshots: [makeSnapshot()],
  bondLevel: "friend" as BondLevel,
  totalInteractions: 42,
  dominantMood: "calm" as SurfaceMood,
  streakDays: 7,
  kovyName: "Kovy",
};

describe("StoryEngine — v9.0", () => {
  let engine: StoryEngine;

  beforeEach(() => {
    engine = new StoryEngine();
    engine.updateConfig({ ...baseConfig });
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("basic functionality", () => {
    it("isEnabled returns config state", () => {
      expect(engine.isEnabled()).toBe(true);
      engine.updateConfig({ ...baseConfig, enabled: false });
      expect(engine.isEnabled()).toBe(false);
    });

    it("run returns null when disabled", () => {
      engine.updateConfig({ ...baseConfig, enabled: false });
      const result = engine.run({ config: { ...baseConfig, enabled: false }, inputs: baseInputs });
      expect(result).toBeNull();
    });
  });

  describe("shouldBuildChapter", () => {
    it("returns true when past configured weekday/hour", () => {
      // Sunday at 8 PM
      const now = new Date(2026, 0, 4, 20, 0, 0); // Jan 4 2026 is a Sunday
      expect(engine.shouldBuildChapter(now, [])).toBe(true);
    });

    it("returns false before configured hour", () => {
      // Sunday at 10 AM — before 8 PM
      const now = new Date(2026, 0, 4, 10, 0, 0);
      expect(engine.shouldBuildChapter(now, [])).toBe(false);
    });

    it("returns false when chapter already exists for this week", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const weekStart = new Date(2026, 0, 4);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const existing: StoryChapter[] = [{
        id: `story-${weekStart.getTime()}`,
        weekStart: weekStart.getTime(),
        weekEnd: weekStart.getTime() + 7 * 24 * 60 * 60 * 1000,
        title: "Existing",
        sections: [],
        generatedAt: now.getTime(),
        aiPolished: false,
      }];
      expect(engine.shouldBuildChapter(now, existing)).toBe(false);
    });

    it("returns false when disabled", () => {
      engine.updateConfig({ ...baseConfig, enabled: false });
      const now = new Date(2026, 0, 4, 20, 0, 0);
      expect(engine.shouldBuildChapter(now, [])).toBe(false);
    });
  });

  describe("buildChapter", () => {
    it("builds a chapter with title and sections", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      expect(chapter.title).toContain("Kovy");
      expect(chapter.sections.length).toBeGreaterThan(0);
      expect(chapter.weekStart).toBeGreaterThan(0);
      expect(chapter.weekEnd).toBeGreaterThan(chapter.weekStart);
    });

    it("includes an opening section", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      const opening = chapter.sections.find(s => s.heading === "The Week");
      expect(opening).toBeDefined();
      expect(opening!.body).toContain("Kovy");
    });

    it("includes a highlights section", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      const highlights = chapter.sections.find(s => s.heading === "Highlights");
      expect(highlights).toBeDefined();
    });

    it("includes a bond section when bondLevel is provided", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter({ ...baseInputs, bondLevel: "best_friend" }, now);
      const bond = chapter.sections.find(s => s.heading === "Our Bond");
      expect(bond).toBeDefined();
      expect(bond!.body).toContain("best friend");
    });

    it("includes a mood section", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter({ ...baseInputs, dominantMood: "excited" }, now);
      const mood = chapter.sections.find(s => s.heading === "Inner Weather");
      expect(mood).toBeDefined();
      expect(mood!.body).toContain("excited");
    });

    it("includes a closing section", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      const closing = chapter.sections.find(s => s.heading === "Looking Forward");
      expect(closing).toBeDefined();
    });

    it("marks chapter as not AI polished by default", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      expect(chapter.aiPolished).toBe(false);
    });
  });

  describe("run", () => {
    it("builds and persists a chapter when it's time", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const result = engine.run({ config: baseConfig, inputs: baseInputs, now });
      expect(result).not.toBeNull();
      expect(result!.title).toContain("Kovy");
      // Verify it was persisted
      const chapters = loadStoryChapters();
      expect(chapters.length).toBe(1);
    });

    it("does not build when not time yet", () => {
      const now = new Date(2026, 0, 4, 10, 0, 0); // before 8 PM
      const result = engine.run({ config: baseConfig, inputs: baseInputs, now });
      expect(result).toBeNull();
    });

    it("does not build when chapter already exists for this week", () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      // First run builds the chapter
      engine.run({ config: baseConfig, inputs: baseInputs, now });
      // Second run should not build again
      const result = engine.run({ config: baseConfig, inputs: baseInputs, now });
      expect(result).toBeNull();
    });
  });

  describe("storage", () => {
    it("persistStoryChapter stores chapter", () => {
      const chapter: StoryChapter = {
        id: "test-1",
        weekStart: 1000,
        weekEnd: 2000,
        title: "Test Chapter",
        sections: [{ heading: "Test", body: "Body" }],
        generatedAt: Date.now(),
        aiPolished: false,
      };
      persistStoryChapter(chapter, 26);
      const loaded = loadStoryChapters();
      expect(loaded.length).toBe(1);
      expect(loaded[0].title).toBe("Test Chapter");
    });

    it("loadStoryChapters returns empty when nothing stored", () => {
      clearStoryChapters();
      expect(loadStoryChapters()).toEqual([]);
    });

    it("clearStoryChapters removes all chapters", () => {
      const chapter: StoryChapter = {
        id: "test-1",
        weekStart: 1000,
        weekEnd: 2000,
        title: "Test",
        sections: [],
        generatedAt: Date.now(),
        aiPolished: false,
      };
      persistStoryChapter(chapter, 26);
      expect(loadStoryChapters().length).toBe(1);
      clearStoryChapters();
      expect(loadStoryChapters()).toEqual([]);
    });

    it("respects retention limit", () => {
      // Add more chapters than retention allows
      for (let i = 0; i < 30; i++) {
        persistStoryChapter({
          id: `test-${i}`,
          weekStart: i * 1000,
          weekEnd: i * 1000 + 999,
          title: `Chapter ${i}`,
          sections: [],
          generatedAt: Date.now(),
          aiPolished: false,
        }, 10); // retention = 10 weeks
      }
      const loaded = loadStoryChapters();
      expect(loaded.length).toBeLessThanOrEqual(10);
    });
  });

  describe("polishChapter", () => {
    it("marks chapter as AI polished", async () => {
      const now = new Date(2026, 0, 4, 20, 0, 0);
      const chapter = engine.buildChapter(baseInputs, now);
      const polished = await engine.polishChapter(chapter);
      expect(polished.aiPolished).toBe(true);
    });
  });

  describe("destroy", () => {
    it("clears state on destroy", () => {
      engine.destroy();
      expect(engine.isEnabled()).toBe(false);
    });
  });
});
