// ============================================================
// Growth Engine tests — v9.0
// Verifies stage progression (sprout -> young -> mature -> elder),
// progress-to-next, size multipliers, aging rate, persistence,
// reset, and debounced save / flush.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GrowthEngine, NULL_GROWTH_OUTPUT } from "@/engine/growthEngine";
import type { GrowthConfig } from "@/store/types";

const baseConfig: GrowthConfig = {
  enabled: true,
  agingRate: 1.0,
  stageThresholds: {
    young: 1,    // 1 day
    mature: 7,   // 7 days
    elder: 30,   // 30 days
  },
};

const DAY_MS = 1000 * 60 * 60 * 24;

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

describe("GrowthEngine — v9.0", () => {
  let engine: GrowthEngine;
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    engine = new GrowthEngine();
  });

  afterEach(() => {
    engine.flush();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("basic functionality", () => {
    it("returns NULL_GROWTH_OUTPUT when disabled", () => {
      const out = engine.update(0.016, { ...baseConfig, enabled: false });
      expect(out).toEqual(NULL_GROWTH_OUTPUT);
      expect(out.enabled).toBe(false);
    });

    it("starts as sprout with zero age", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.enabled).toBe(true);
      expect(out.stage).toBe("sprout");
      expect(out.ageDays).toBeCloseTo(0, 5);
    });

    it("sprout has size multiplier 0.75", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.sizeMultiplier).toBe(0.75);
    });

    it("progressToNext is 0 at birth", () => {
      const out = engine.update(0.016, baseConfig);
      expect(out.progressToNext).toBeCloseTo(0, 5);
    });
  });

  describe("stage progression", () => {
    it("reaches young stage after young threshold days", () => {
      vi.advanceTimersByTime(2 * DAY_MS);
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("young");
      expect(out.sizeMultiplier).toBe(0.9);
    });

    it("reaches mature stage after mature threshold days", () => {
      vi.advanceTimersByTime(10 * DAY_MS);
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("mature");
      expect(out.sizeMultiplier).toBe(1.0);
    });

    it("reaches elder stage after elder threshold days", () => {
      vi.advanceTimersByTime(35 * DAY_MS);
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("elder");
      expect(out.sizeMultiplier).toBe(1.05);
    });

    it("elder progressToNext is capped at 1.0", () => {
      vi.advanceTimersByTime(100 * DAY_MS);
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("elder");
      expect(out.progressToNext).toBe(1.0);
    });

    it("progressToNext increases within young stage", () => {
      vi.advanceTimersByTime(4 * DAY_MS); // 4 days, young threshold 1, mature 7
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("young");
      // (4 - 1) / (7 - 1) = 0.5
      expect(out.progressToNext).toBeCloseTo(0.5, 2);
    });

    it("progressToNext increases within sprout stage", () => {
      vi.advanceTimersByTime(0.5 * DAY_MS); // half a day, young threshold 1
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("sprout");
      expect(out.progressToNext).toBeCloseTo(0.5, 2);
    });

    it("progressToNext increases within mature stage", () => {
      vi.advanceTimersByTime(18.5 * DAY_MS); // mature threshold 7, elder 30
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("mature");
      // (18.5 - 7) / (30 - 7) = 11.5/23 = 0.5
      expect(out.progressToNext).toBeCloseTo(0.5, 2);
    });
  });

  describe("aging rate", () => {
    it("agingRate accelerates age progression", () => {
      const cfg = { ...baseConfig, agingRate: 2.0 };
      // 1 real day * 2.0 = 2 age days -> young (threshold 1)
      vi.advanceTimersByTime(1 * DAY_MS);
      const out = engine.update(0.016, cfg);
      expect(out.stage).toBe("young");
      expect(out.ageDays).toBeCloseTo(2, 5);
    });

    it("agingRate slows age progression", () => {
      const cfg = { ...baseConfig, agingRate: 0.5 };
      // 2 real days * 0.5 = 1 age day -> exactly young threshold (>= 1 -> young)
      vi.advanceTimersByTime(2 * DAY_MS);
      const out = engine.update(0.016, cfg);
      expect(out.stage).toBe("young");
    });
  });

  describe("config updates", () => {
    it("respects updated stage thresholds", () => {
      const cfg = {
        ...baseConfig,
        stageThresholds: { young: 10, mature: 20, elder: 40 },
      };
      vi.advanceTimersByTime(5 * DAY_MS);
      const out = engine.update(0.016, cfg);
      expect(out.stage).toBe("sprout");
      expect(out.progressToNext).toBeCloseTo(0.5, 2);
    });

    it("can be toggled disabled mid-run", () => {
      vi.advanceTimersByTime(5 * DAY_MS);
      const out = engine.update(0.016, { ...baseConfig, enabled: false });
      expect(out).toEqual(NULL_GROWTH_OUTPUT);
    });
  });

  describe("persistence", () => {
    it("saves initial state to localStorage on first launch", () => {
      const raw = store["kovy-growth-state"];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed.firstLaunchTime).toBe(Date.now());
      expect(parsed.lastUpdate).toBe(Date.now());
    });

    it("loads firstLaunchTime from localStorage", () => {
      const oldLaunch = Date.now() - 5 * DAY_MS;
      store["kovy-growth-state"] = JSON.stringify({
        firstLaunchTime: oldLaunch,
        lastUpdate: oldLaunch,
      });
      engine = new GrowthEngine();
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("young"); // 5 days > young threshold 1
    });

    it("falls back to now when stored state is invalid", () => {
      store["kovy-growth-state"] = JSON.stringify({ foo: "bar" });
      engine = new GrowthEngine();
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("sprout");
      expect(out.ageDays).toBeCloseTo(0, 5);
    });

    it("falls back to now when stored JSON is corrupt", () => {
      store["kovy-growth-state"] = "{not valid json";
      engine = new GrowthEngine();
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("sprout");
    });
  });

  describe("reset", () => {
    it("reset sets firstLaunchTime back to now", () => {
      vi.advanceTimersByTime(40 * DAY_MS);
      engine.update(0.016, baseConfig); // would be elder
      engine.reset();
      const out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("sprout");
      expect(out.ageDays).toBeCloseTo(0, 5);
    });

    it("reset persists the new state to localStorage", () => {
      engine.reset();
      const raw = store["kovy-growth-state"];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed.firstLaunchTime).toBe(Date.now());
    });
  });

  describe("debounced save & flush", () => {
    it("update schedules a debounced save (not immediate)", () => {
      const before = store["kovy-growth-state"];
      engine.update(0.016, baseConfig);
      // The debounced save writes lastUpdate=now; immediate save in load already wrote.
      // After update, the stored lastUpdate should still be the old value until timer fires.
      const parsed = JSON.parse(store["kovy-growth-state"]);
      expect(parsed.lastUpdate).toBe(JSON.parse(before!).lastUpdate);
    });

    it("flush writes the pending debounced save immediately", () => {
      vi.advanceTimersByTime(5 * DAY_MS);
      engine.update(0.016, baseConfig);
      engine.flush();
      const parsed = JSON.parse(store["kovy-growth-state"]);
      expect(parsed.lastUpdate).toBe(Date.now());
    });

    it("flush is a no-op when no save is pending", () => {
      // should not throw
      engine.flush();
      expect(store["kovy-growth-state"]).toBeDefined();
    });

    it("debounced save fires after 2000ms", () => {
      vi.advanceTimersByTime(5 * DAY_MS);
      engine.update(0.016, baseConfig);
      const beforeUpdate = JSON.parse(store["kovy-growth-state"]).lastUpdate;
      vi.advanceTimersByTime(2000);
      const after = JSON.parse(store["kovy-growth-state"]).lastUpdate;
      expect(after).toBeGreaterThan(beforeUpdate);
    });
  });

  describe("edge cases", () => {
    it("handles zero dt", () => {
      const out = engine.update(0, baseConfig);
      expect(out.stage).toBe("sprout");
    });

    it("clamps progressToNext within [0,1] for sprout", () => {
      // age 0 -> 0/1 = 0
      const out = engine.update(0.016, baseConfig);
      expect(out.progressToNext).toBeGreaterThanOrEqual(0);
      expect(out.progressToNext).toBeLessThanOrEqual(1);
    });

    it("does not regress to a lower stage once elder reached", () => {
      vi.advanceTimersByTime(100 * DAY_MS);
      let out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("elder");
      // another update shortly after
      vi.advanceTimersByTime(1000);
      out = engine.update(0.016, baseConfig);
      expect(out.stage).toBe("elder");
    });
  });
});
