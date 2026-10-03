// ============================================================
// Seasonal Engine tests — v7.0
// Verifies holiday detection, custom events, hemisphere-aware
// seasons, disabled state, and date tolerance.
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SeasonalEngine, NULL_SEASONAL_OUTPUT } from "@/engine/seasonalEngine";
import type { SeasonalConfig, SeasonalEventId } from "@/store/types";

const baseConfig: SeasonalConfig = {
  enabled: true,
  events: ["halloween", "christmas", "newyear", "valentines", "stpatricks", "summerSolstice", "autumnEquinox"],
  customEvents: [],
  hemisphere: "northern",
};

describe("SeasonalEngine — v7.0", () => {
  let engine: SeasonalEngine;

  beforeEach(() => {
    engine = new SeasonalEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic functionality", () => {
    it("returns NULL_SEASONAL_OUTPUT when disabled", () => {
      const out = engine.update({ ...baseConfig, enabled: false });
      expect(out).toBe(NULL_SEASONAL_OUTPUT);
      expect(out.enabled).toBe(false);
      expect(out.activeEvents).toEqual([]);
    });

    it("returns enabled output with current season and hemisphere", () => {
      const out = engine.update(baseConfig);
      expect(out.enabled).toBe(true);
      expect(["spring", "summer", "autumn", "winter"]).toContain(out.currentSeason);
      expect(out.hemisphere).toBe("northern");
    });

    it("NULL_SEASONAL_OUTPUT has expected shape", () => {
      expect(NULL_SEASONAL_OUTPUT.enabled).toBe(false);
      expect(NULL_SEASONAL_OUTPUT.activeEvents).toEqual([]);
      expect(NULL_SEASONAL_OUTPUT.currentSeason).toBe("spring");
      expect(NULL_SEASONAL_OUTPUT.hemisphere).toBe("northern");
    });

    it("activeEvents is an array", () => {
      const out = engine.update(baseConfig);
      expect(Array.isArray(out.activeEvents)).toBe(true);
    });
  });

  describe("hemisphere & seasons", () => {
    it("northern and southern return opposite seasons near solstice", () => {
      // Mock date to June 25 (northern summer, southern winter)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 25)); // month is 0-indexed: 5 = June
      const north = engine.update({ ...baseConfig, hemisphere: "northern" });
      const south = engine.update({ ...baseConfig, hemisphere: "southern" });
      expect(north.currentSeason).toBe("summer");
      expect(south.currentSeason).toBe("winter");
      vi.useRealTimers();
    });

    it("northern spring around March 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 2, 25)); // March 25
      const out = engine.update({ ...baseConfig, hemisphere: "northern" });
      expect(out.currentSeason).toBe("spring");
      vi.useRealTimers();
    });

    it("northern autumn around September 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 8, 25)); // September 25
      const out = engine.update({ ...baseConfig, hemisphere: "northern" });
      expect(out.currentSeason).toBe("autumn");
      vi.useRealTimers();
    });

    it("northern winter around December 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 25)); // December 25
      const out = engine.update({ ...baseConfig, hemisphere: "northern" });
      expect(out.currentSeason).toBe("winter");
      vi.useRealTimers();
    });

    it("southern spring around September 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 8, 25));
      const out = engine.update({ ...baseConfig, hemisphere: "southern" });
      expect(out.currentSeason).toBe("spring");
      vi.useRealTimers();
    });

    it("southern summer around December 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 25));
      const out = engine.update({ ...baseConfig, hemisphere: "southern" });
      expect(out.currentSeason).toBe("summer");
      vi.useRealTimers();
    });

    it("returns the configured hemisphere in output", () => {
      const out = engine.update({ ...baseConfig, hemisphere: "southern" });
      expect(out.hemisphere).toBe("southern");
    });
  });

  describe("built-in event detection", () => {
    it("detects Halloween on Oct 31", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 31)); // Oct 31
      const out = engine.update(baseConfig);
      const halloween = out.activeEvents.find(e => e.id === "halloween");
      expect(halloween).toBeDefined();
      expect(halloween!.name).toBe("Halloween");
      expect(halloween!.icon).toBe("🎃");
      expect(halloween!.isCustom).toBe(false);
      vi.useRealTimers();
    });

    it("detects Christmas on Dec 25", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 25));
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "christmas")).toBeDefined();
      vi.useRealTimers();
    });

    it("detects New Year on Jan 01", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1));
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "newyear")).toBeDefined();
      vi.useRealTimers();
    });

    it("detects Valentine's Day on Feb 14", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 1, 14));
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "valentines")).toBeDefined();
      vi.useRealTimers();
    });

    it("detects event within 1-day tolerance (day before)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 30)); // Oct 30, 1 day before Halloween
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "halloween")).toBeDefined();
      vi.useRealTimers();
    });

    it("detects event within 1-day tolerance (day after)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 10, 1)); // Nov 1, 1 day after Halloween
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "halloween")).toBeDefined();
      vi.useRealTimers();
    });

    it("does not detect event outside tolerance", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 28)); // Oct 28, 3 days before Halloween
      const out = engine.update(baseConfig);
      expect(out.activeEvents.find(e => e.id === "halloween")).toBeUndefined();
      vi.useRealTimers();
    });

    it("only detects enabled events", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 31)); // Halloween
      const out = engine.update({ ...baseConfig, events: ["christmas"] });
      expect(out.activeEvents.find(e => e.id === "halloween")).toBeUndefined();
      vi.useRealTimers();
    });

    it("ignores unknown event ids in config", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15));
      const out = engine.update({ ...baseConfig, events: ["unknownEvent" as SeasonalEventId] });
      expect(out.activeEvents).toHaveLength(0);
      vi.useRealTimers();
    });

    it("empty events list yields no built-in events", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 31));
      const out = engine.update({ ...baseConfig, events: [] });
      expect(out.activeEvents.filter(e => !e.isCustom)).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe("custom events", () => {
    it("detects custom event on its date", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 6, 4)); // July 4
      const out = engine.update({
        ...baseConfig,
        events: [],
        customEvents: [{ id: "custom1", name: "My Birthday", date: "07-04", icon: "🎂" }],
      });
      const ev = out.activeEvents.find(e => e.id === "custom1");
      expect(ev).toBeDefined();
      expect(ev!.name).toBe("My Birthday");
      expect(ev!.icon).toBe("🎂");
      expect(ev!.isCustom).toBe(true);
      vi.useRealTimers();
    });

    it("detects custom event within tolerance", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 6, 5)); // July 5, 1 day after
      const out = engine.update({
        ...baseConfig,
        events: [],
        customEvents: [{ id: "custom1", name: "My Birthday", date: "07-04", icon: "🎂" }],
      });
      expect(out.activeEvents.find(e => e.id === "custom1")).toBeDefined();
      vi.useRealTimers();
    });

    it("does not detect custom event outside tolerance", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 6, 10)); // July 10, 6 days after
      const out = engine.update({
        ...baseConfig,
        events: [],
        customEvents: [{ id: "custom1", name: "My Birthday", date: "07-04", icon: "🎂" }],
      });
      expect(out.activeEvents.find(e => e.id === "custom1")).toBeUndefined();
      vi.useRealTimers();
    });

    it("can detect both built-in and custom events simultaneously", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 31)); // Halloween
      const out = engine.update({
        ...baseConfig,
        customEvents: [{ id: "custom1", name: "Halloween Party", date: "10-31", icon: "👻" }],
      });
      expect(out.activeEvents.find(e => e.id === "halloween")).toBeDefined();
      expect(out.activeEvents.find(e => e.id === "custom1")).toBeDefined();
      vi.useRealTimers();
    });

    it("empty customEvents yields no custom events", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 9, 31));
      const out = engine.update({ ...baseConfig, events: [], customEvents: [] });
      expect(out.activeEvents).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe("config updates", () => {
    it("reflects changed hemisphere on next update", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 25));
      const out1 = engine.update({ ...baseConfig, hemisphere: "northern" });
      expect(out1.currentSeason).toBe("summer");
      const out2 = engine.update({ ...baseConfig, hemisphere: "southern" });
      expect(out2.currentSeason).toBe("winter");
      vi.useRealTimers();
    });

    it("reflects disabled state on next update", () => {
      engine.update(baseConfig);
      const out = engine.update({ ...baseConfig, enabled: false });
      expect(out.enabled).toBe(false);
    });
  });
});
