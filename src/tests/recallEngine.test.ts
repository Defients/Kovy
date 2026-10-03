// ============================================================
// Recall Engine tests — v9.0
// Verifies memory recall thought spawning, significance filtering,
// age filtering, and chance gating.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RecallEngine } from "@/engine/recallEngine";
import type { RecallConfig, MemoryRecord, SurfaceMood, Vec2 } from "@/store/types";

// Mock the memoryDb module
vi.mock("@/lib/memoryDb", () => ({
  getRecentMemories: vi.fn(),
  isMemoryDbAvailable: vi.fn(),
}));

import { getRecentMemories, isMemoryDbAvailable } from "@/lib/memoryDb";

const baseConfig: RecallConfig = {
  enabled: true,
  chance: 1.0, // always recall for testing
  minSignificance: 0.5,
  maxAgeDays: 60,
};

function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: Math.floor(Math.random() * 10000),
    entityId: "founder",
    type: "interaction",
    significance: 0.7,
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    duration: 60,
    valence: 0.5,
    stimulation: 0.3,
    tags: "calm",
    appProcess: "chrome",
    appTitle: "Chrome",
    summary: "A nice interaction",
    data: null,
    ...overrides,
  };
}

describe("RecallEngine — v9.0", () => {
  let engine: RecallEngine;

  beforeEach(() => {
    engine = new RecallEngine();
    engine.updateConfig({ ...baseConfig });
    vi.clearAllMocks();
    vi.mocked(isMemoryDbAvailable).mockResolvedValue(true);
  });

  describe("basic functionality", () => {
    it("starts with no pending thought", () => {
      expect(engine.consumeThought()).toBeNull();
    });

    it("isEnabled returns config state", () => {
      expect(engine.isEnabled()).toBe(true);
      engine.updateConfig({ ...baseConfig, enabled: false });
      expect(engine.isEnabled()).toBe(false);
    });

    it("does not recall when disabled", async () => {
      engine.updateConfig({ ...baseConfig, enabled: false });
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
      expect(engine.consumeThought()).toBeNull();
    });

    it("does not recall before tick interval", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      const result = await engine.update(10, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });
  });

  describe("recall triggering", () => {
    it("triggers recall after tick interval", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(true);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.text).toBeDefined();
      expect(thought!.memoryId).toBeDefined();
    });

    it("does not recall when chance is 0", async () => {
      engine.updateConfig({ ...baseConfig, chance: 0 });
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });

    it("does not recall when no memories exist", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });

    it("does not recall when DB is unavailable", async () => {
      vi.mocked(isMemoryDbAvailable).mockResolvedValue(false);
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });
  });

  describe("filtering", () => {
    it("filters out low-significance memories", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, significance: 0.3 }),
      ]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });

    it("filters out too-old memories", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, timestamp: Date.now() - 90 * 24 * 60 * 60 * 1000 }), // 90 days ago
      ]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });

    it("keeps memories above significance threshold", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, significance: 0.6 }),
      ]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(true);
    });

    it("keeps memories within age limit", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 }), // 30 days ago
      ]);
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(true);
    });

    it("does not recall the same memory twice in a row", async () => {
      const mem = makeMemory({ id: 42 });
      vi.mocked(getRecentMemories).mockResolvedValue([mem]);
      // First recall
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      const thought1 = engine.consumeThought();
      expect(thought1).not.toBeNull();
      expect(thought1!.memoryId).toBe(42);
      // Second recall — should not recall the same memory
      // With only one memory and it being excluded, should return false
      const result = await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      expect(result).toBe(false);
    });
  });

  describe("thought formatting", () => {
    it("formats app_session memories with app name", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, type: "app_session", appProcess: "vscode" }),
      ]);
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.text).toContain("vscode");
    });

    it("formats interaction memories", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, type: "interaction" }),
      ]);
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.text).toContain("...");
    });

    it("includes age in days in the recall thought", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1, timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000 }),
      ]);
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.ageDays).toBe(14);
    });

    it("sets position near Kovy", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([
        makeMemory({ id: 1 }),
      ]);
      await engine.update(31, "founder", { x: 500, y: 300 } as Vec2, "calm" as SurfaceMood);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.position.x).toBe(500);
      expect(thought!.position.y).toBe(260); // 300 - 40
    });
  });

  describe("consumeThought", () => {
    it("clears the pending thought after consuming", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      const t1 = engine.consumeThought();
      expect(t1).not.toBeNull();
      const t2 = engine.consumeThought();
      expect(t2).toBeNull();
    });
  });

  describe("destroy", () => {
    it("clears state on destroy", async () => {
      vi.mocked(getRecentMemories).mockResolvedValue([makeMemory()]);
      await engine.update(31, "founder", { x: 100, y: 100 } as Vec2, "calm" as SurfaceMood);
      engine.destroy();
      expect(engine.isEnabled()).toBe(false);
      expect(engine.consumeThought()).toBeNull();
    });
  });
});
