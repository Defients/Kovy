import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StatsEngine, NULL_STATS_OUTPUT } from "@/engine/statsEngine";

describe("StatsEngine", () => {
  let store: Record<string, string>;
  let engine: StatsEngine;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
    engine = new StatsEngine();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with default stats (all zeros)", () => {
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.enabled).toBe(true);
    expect(out.stats.totalPokes).toBe(0);
    expect(out.stats.totalHovers).toBe(0);
    expect(out.stats.totalSwipes).toBe(0);
    expect(out.stats.totalDragReleases).toBe(0);
    expect(out.stats.totalProfileSwitches).toBe(0);
    expect(out.stats.totalRituals).toBe(0);
    expect(out.stats.totalFamilyInteractions).toBe(0);
    expect(out.stats.totalWeatherChanges).toBe(0);
    expect(out.stats.totalSeasonalEvents).toBe(0);
    expect(out.stats.totalGrowthEvents).toBe(0);
  });

  it("recordPoke increments totalPokes", () => {
    engine.recordPoke();
    engine.recordPoke();
    engine.recordPoke();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalPokes).toBe(3);
  });

  it("recordHover increments totalHovers", () => {
    engine.recordHover();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalHovers).toBe(1);
  });

  it("recordSwipe increments totalSwipes", () => {
    engine.recordSwipe();
    engine.recordSwipe();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalSwipes).toBe(2);
  });

  it("recordFocusMinutes accumulates and tracks longest", () => {
    engine.recordFocusMinutes(5);
    engine.recordFocusMinutes(10);
    engine.recordFocusMinutes(3);
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalFocusMinutes).toBe(18);
    expect(out.stats.longestFocusSession).toBe(10);
  });

  it("recordIdleMinutes accumulates", () => {
    engine.recordIdleMinutes(2);
    engine.recordIdleMinutes(3);
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalIdleMinutes).toBe(5);
  });

  it("recordGamingSession increments", () => {
    engine.recordGamingSession();
    engine.recordGamingSession();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalGamingSessions).toBe(2);
  });

  it("recordEmote increments", () => {
    engine.recordEmote();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalEmotes).toBe(1);
  });

  it("recordThought increments", () => {
    engine.recordThought();
    engine.recordThought();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalThoughts).toBe(2);
  });

  it("recordWhisper increments", () => {
    engine.recordWhisper();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalWhispers).toBe(1);
  });

  it("recordDragRelease increments totalDragReleases", () => {
    engine.recordDragRelease();
    engine.recordDragRelease();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalDragReleases).toBe(2);
  });

  it("recordProfileSwitch increments totalProfileSwitches", () => {
    engine.recordProfileSwitch();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalProfileSwitches).toBe(1);
  });

  it("recordRitual increments totalRituals", () => {
    engine.recordRitual();
    engine.recordRitual();
    engine.recordRitual();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalRituals).toBe(3);
  });

  it("recordFamilyInteraction increments totalFamilyInteractions", () => {
    engine.recordFamilyInteraction();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalFamilyInteractions).toBe(1);
  });

  it("recordWeatherChange increments totalWeatherChanges", () => {
    engine.recordWeatherChange();
    engine.recordWeatherChange();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalWeatherChanges).toBe(2);
  });

  it("recordSeasonalEvent increments totalSeasonalEvents", () => {
    engine.recordSeasonalEvent();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalSeasonalEvents).toBe(1);
  });

  it("recordGrowthEvent increments totalGrowthEvents", () => {
    engine.recordGrowthEvent();
    engine.recordGrowthEvent();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalGrowthEvents).toBe(2);
  });

  it("persists to localStorage", () => {
    engine.recordPoke();
    engine.recordHover();
    engine.flushSave();
    const raw = localStorage.getItem("kovy-stats");
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.totalPokes).toBe(1);
    expect(parsed.totalHovers).toBe(1);
  });

  it("loads from localStorage on construction", () => {
    engine.recordPoke();
    engine.recordEmote();
    engine.flushSave();
    const engine2 = new StatsEngine();
    const out = engine2.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalPokes).toBe(1);
    expect(out.stats.totalEmotes).toBe(1);
  });

  it("reset clears all stats", () => {
    engine.recordPoke();
    engine.recordHover();
    engine.recordRitual();
    engine.reset();
    const out = engine.update({ enabled: true, trackingLevel: "standard" });
    expect(out.stats.totalPokes).toBe(0);
    expect(out.stats.totalHovers).toBe(0);
    expect(out.stats.totalRituals).toBe(0);
  });

  it("disabled config returns null output", () => {
    const out = engine.update({ enabled: false, trackingLevel: "standard" });
    expect(out.enabled).toBe(false);
  });

  it("NULL_STATS_OUTPUT has all fields zeroed", () => {
    expect(NULL_STATS_OUTPUT.stats.totalPokes).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalDragReleases).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalProfileSwitches).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalRituals).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalFamilyInteractions).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalWeatherChanges).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalSeasonalEvents).toBe(0);
    expect(NULL_STATS_OUTPUT.stats.totalGrowthEvents).toBe(0);
  });

  it("daysActive increments on date change", () => {
    engine.recordPoke(); // force a save
    engine.flushSave();
    const out1 = engine.update({ enabled: true, trackingLevel: "standard" });
    const initialDays = out1.stats.daysActive;
    // Simulate a different date by manipulating localStorage
    const raw = store["kovy-stats"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    parsed.lastActiveDate = "2020-01-01";
    store["kovy-stats"] = JSON.stringify(parsed);
    const engine2 = new StatsEngine();
    const out2 = engine2.update({ enabled: true, trackingLevel: "standard" });
    expect(out2.stats.daysActive).toBe(initialDays + 1);
  });
});
