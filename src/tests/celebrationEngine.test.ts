// ============================================================
// Celebration Engine tests — v9.0
// Verifies focus milestone, return celebration, weekend events,
// personality messages, persistence, and consume/clear behavior.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CelebrationEngine,
  NULL_CELEBRATION_OUTPUT,
} from "@/engine/celebrationEngine";
import type { CelebrationConfig, BehaviorPreset } from "@/store/types";

const baseConfig: CelebrationConfig = {
  enabled: true,
  focusThreshold: 25, // minutes
  returnThreshold: 12, // hours
  weekendCelebration: true,
};

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  });
  return store;
}

describe("CelebrationEngine — v9.0", () => {
  let engine: CelebrationEngine;
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-04T10:00:00Z")); // Wednesday
    engine = new CelebrationEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("basic functionality", () => {
    it("returns NULL_CELEBRATION_OUTPUT when disabled", () => {
      const out = engine.update({ ...baseConfig, enabled: false }, 0);
      expect(out).toEqual(NULL_CELEBRATION_OUTPUT);
      expect(out.enabled).toBe(false);
      expect(out.pendingEvent).toBeNull();
    });

    it("returns enabled output with no event when nothing triggers", () => {
      // record activity so no return celebration triggers
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.enabled).toBe(true);
      expect(out.pendingEvent).toBeNull();
    });

    it("consumeEvent returns null when no event pending", () => {
      expect(engine.consumeEvent()).toBeNull();
    });

    it("consumeEvent clears the pending event", () => {
      // Trigger a focus milestone
      const out = engine.update(baseConfig, 30);
      expect(out.pendingEvent).not.toBeNull();
      const evt = engine.consumeEvent();
      expect(evt).not.toBeNull();
      expect(engine.consumeEvent()).toBeNull();
    });
  });

  describe("focus milestone celebration", () => {
    it("triggers a focus_milestone event when threshold reached", () => {
      const out = engine.update(baseConfig, 25);
      expect(out.pendingEvent).not.toBeNull();
      expect(out.pendingEvent!.type).toBe("focus_milestone");
      expect(out.pendingEvent!.intensity).toBe(0.8);
    });

    it("does not re-trigger for the same milestone", () => {
      engine.update(baseConfig, 30);
      // second update at same focus minutes should not re-trigger
      engine.recordUserActivity(); // avoid return celebration
      const out = engine.update(baseConfig, 30);
      expect(out.pendingEvent).toBeNull();
    });

    it("triggers again when passing into the next milestone", () => {
      engine.update(baseConfig, 25);
      engine.consumeEvent();
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 50);
      expect(out.pendingEvent).not.toBeNull();
      expect(out.pendingEvent!.type).toBe("focus_milestone");
    });

    it("does not trigger when focusMinutes is below threshold", () => {
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 10);
      expect(out.pendingEvent).toBeNull();
    });

    it("does not trigger when focusMinutes is zero", () => {
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });

    it("uses fallback message when no personality preset", () => {
      const out = engine.update(baseConfig, 25);
      expect(out.pendingEvent!.message).toContain("25 minutes of focus");
    });
  });

  describe("return celebration", () => {
    it("triggers return_celebration after absence >= threshold hours", () => {
      engine.recordUserActivity();
      // advance time past returnThreshold (12 hours)
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).not.toBeNull();
      expect(out.pendingEvent!.type).toBe("return_celebration");
    });

    it("does not trigger return celebration before threshold", () => {
      engine.recordUserActivity();
      vi.advanceTimersByTime(5 * 60 * 60 * 1000); // 5h < 12h
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });

    it("intensity is clamped to a minimum of 0.3", () => {
      engine.recordUserActivity();
      vi.advanceTimersByTime(13 * 60 * 60 * 1000); // just over threshold
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent!.intensity).toBeGreaterThanOrEqual(0.3);
    });

    it("intensity grows with longer absence but caps at 1.0", () => {
      engine.recordUserActivity();
      // very long absence -> awayHours/(returnThreshold*2) > 1
      vi.advanceTimersByTime(100 * 60 * 60 * 1000);
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent!.intensity).toBeLessThanOrEqual(1.0);
    });

    it("resets lastSeen after triggering return celebration", () => {
      engine.recordUserActivity();
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);
      engine.update(baseConfig, 0);
      // immediate next update should not re-trigger
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });
  });

  describe("weekend celebration", () => {
    it("triggers weekend event on a Saturday", () => {
      vi.setSystemTime(new Date("2025-06-07T10:00:00Z")); // Saturday
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).not.toBeNull();
      expect(out.pendingEvent!.type).toBe("weekend");
      expect(out.pendingEvent!.intensity).toBe(0.5);
    });

    it("triggers weekend event on a Sunday", () => {
      vi.setSystemTime(new Date("2025-06-08T10:00:00Z")); // Sunday
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent!.type).toBe("weekend");
    });

    it("does not trigger weekend event on a weekday", () => {
      // Wednesday (default in beforeEach)
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });

    it("does not re-trigger weekend celebration same day", () => {
      vi.setSystemTime(new Date("2025-06-07T10:00:00Z")); // Saturday
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      engine.update(baseConfig, 0);
      engine.consumeEvent();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });

    it("does not trigger weekend event when weekendCelebration disabled", () => {
      vi.setSystemTime(new Date("2025-06-07T10:00:00Z")); // Saturday
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      const out = engine.update({ ...baseConfig, weekendCelebration: false }, 0);
      expect(out.pendingEvent).toBeNull();
    });
  });

  describe("personality messages", () => {
    it("uses goblin personality focus message", () => {
      const out = engine.update(baseConfig, 25, "goblin" as BehaviorPreset);
      expect(out.pendingEvent!.message).toBe("FOCUS COMPLETE! Goblins proud!");
    });

    it("uses chill personality return message", () => {
      engine.recordUserActivity();
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);
      const out = engine.update(baseConfig, 0, "chill" as BehaviorPreset);
      expect(out.pendingEvent!.message).toBe("Oh hey, welcome back.");
    });

    it("uses curious personality weekend message", () => {
      vi.setSystemTime(new Date("2025-06-07T10:00:00Z")); // Saturday
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0, "curious" as BehaviorPreset);
      expect(out.pendingEvent!.message).toBe("Weekend! Let's explore!");
    });

    it("falls back to default message for unknown preset", () => {
      const out = engine.update(baseConfig, 25, "unknown" as BehaviorPreset);
      expect(out.pendingEvent!.message).toContain("25 minutes of focus");
    });
  });

  describe("persistence", () => {
    it("recordUserActivity persists lastSeen to localStorage", () => {
      engine.recordUserActivity();
      const raw = store["kovy-celebration-state"];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed.lastSeen).toBe(Date.now());
    });

    it("loads lastFocusCelebration from localStorage", () => {
      store["kovy-celebration-state"] = JSON.stringify({
        lastSeen: Date.now(),
        lastFocusCelebration: 50,
        lastWeekendCelebration: "",
      });
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      // 50 minutes = 2 milestones at threshold 25; passing 50 again -> same milestone, no event
      const out = engine.update(baseConfig, 50);
      expect(out.pendingEvent).toBeNull();
    });

    it("loads lastWeekendCelebration from localStorage", () => {
      vi.setSystemTime(new Date("2025-06-07T10:00:00Z")); // Saturday
      const todayStr = new Date().toISOString().slice(0, 10);
      store["kovy-celebration-state"] = JSON.stringify({
        lastSeen: Date.now(),
        lastFocusCelebration: 0,
        lastWeekendCelebration: todayStr,
      });
      engine = new CelebrationEngine();
      engine.recordUserActivity();
      const out = engine.update(baseConfig, 0);
      expect(out.pendingEvent).toBeNull();
    });
  });

  describe("config updates", () => {
    it("respects a changed focusThreshold", () => {
      engine.recordUserActivity();
      const out = engine.update({ ...baseConfig, focusThreshold: 10 }, 10);
      expect(out.pendingEvent).not.toBeNull();
      expect(out.pendingEvent!.type).toBe("focus_milestone");
    });

    it("respects a changed returnThreshold", () => {
      engine.recordUserActivity();
      vi.advanceTimersByTime(2 * 60 * 60 * 1000); // 2h
      const out = engine.update({ ...baseConfig, returnThreshold: 1 }, 0);
      expect(out.pendingEvent!.type).toBe("return_celebration");
    });
  });
});
