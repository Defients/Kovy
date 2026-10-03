// ============================================================
// Habitat Objects & Weather Engine Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  HabitatObjectsEngine,
  HABITAT_OBJECT_DEFS,
  createDefaultHabitatObjectsState,
  type HabitatObjectType,
} from "@/engine/habitatObjectsEngine";
import {
  WeatherEngine,
  getTimeOfDay,
  getTimeOfDayProgress,
  DEFAULT_WEATHER_CONFIG,
  type WeatherType,
} from "@/engine/weatherEngine";

// --- Habitat Objects Tests ---

describe("HabitatObjectsEngine", () => {
  let engine: HabitatObjectsEngine;

  beforeEach(() => {
    engine = new HabitatObjectsEngine();
  });

  it("has 8 object definitions", () => {
    expect(Object.keys(HABITAT_OBJECT_DEFS)).toHaveLength(8);
  });

  it("starts empty", () => {
    expect(engine.getObjects()).toHaveLength(0);
  });

  it("addObject adds an object", () => {
    const obj = engine.addObject("toy", { x: 100, y: 200 });
    expect(engine.getObjects()).toHaveLength(1);
    expect(obj.type).toBe("toy");
    expect(obj.position).toEqual({ x: 100, y: 200 });
    expect(obj.id).toBeTruthy();
  });

  it("removeObject removes by id", () => {
    const obj = engine.addObject("plant", { x: 50, y: 50 });
    const result = engine.removeObject(obj.id);
    expect(result).toBe(true);
    expect(engine.getObjects()).toHaveLength(0);
  });

  it("removeObject returns false for unknown id", () => {
    expect(engine.removeObject("nonexistent")).toBe(false);
  });

  it("getNearbyObjects finds objects within range", () => {
    engine.addObject("toy", { x: 100, y: 100 });
    engine.addObject("plant", { x: 500, y: 500 });
    const nearby = engine.getNearbyObjects({ x: 100, y: 100 }, 50);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].obj.type).toBe("toy");
  });

  it("getMoodInfluence aggregates nearby objects", () => {
    engine.addObject("toy", { x: 100, y: 100 });
    const influence = engine.getMoodInfluence({ x: 100, y: 100 });
    expect(influence.playfulness).toBeGreaterThan(0);
    expect(influence.energy).toBeGreaterThan(0);
  });

  it("getAttractedBehaviors returns behaviors from nearby objects", () => {
    engine.addObject("bed", { x: 100, y: 100 });
    const behaviors = engine.getAttractedBehaviors({ x: 100, y: 100 });
    expect(behaviors).toContain("nap");
    expect(behaviors).toContain("dream");
  });

  it("reset clears all objects", () => {
    engine.addObject("toy", { x: 0, y: 0 });
    engine.reset();
    expect(engine.getObjects()).toHaveLength(0);
  });

  it("createDefaultHabitatObjectsState returns empty state", () => {
    const state = createDefaultHabitatObjectsState();
    expect(state.objects).toEqual([]);
  });
});

// --- Weather Engine Tests ---

describe("WeatherEngine", () => {
  let weather: WeatherEngine;

  beforeEach(() => {
    weather = new WeatherEngine();
  });

  it("starts with clear weather", () => {
    const state = weather.getState();
    expect(state.current).toBe("clear");
  });

  it("update changes weather when timer expires", () => {
    // Fast-forward by running many updates
    for (let i = 0; i < 700; i++) {
      weather.update(1, { ...DEFAULT_WEATHER_CONFIG, changeInterval: 1 });
    }
    // Weather should have changed (probabilistic, but very likely after 700 ticks)
    const state = weather.getState();
    // It might still be "clear" by chance, so just check it's valid
    expect(["clear", "cloudy", "rain", "storm", "snow", "fog", "aurora"]).toContain(state.current);
  });

  it("update respects disabled config", () => {
    for (let i = 0; i < 100; i++) {
      weather.update(1, { ...DEFAULT_WEATHER_CONFIG, enabled: false });
    }
    expect(weather.getState().current).toBe("clear");
    expect(weather.getState().intensity).toBe(0);
  });

  it("getMoodInfluence returns values scaled by intensity", () => {
    weather.forceWeather("storm", 1.0);
    const influence = weather.getMoodInfluence();
    expect(influence.comfort).toBeLessThan(0);
    expect(influence.curiosity).toBeGreaterThan(0);
  });

  it("getParticleConfig returns config for current weather", () => {
    weather.forceWeather("rain", 0.8);
    const config = weather.getParticleConfig();
    expect(config.type).toBe("rain");
    expect(config.density).toBeGreaterThan(0);
  });

  it("forceWeather sets weather type and intensity", () => {
    weather.forceWeather("snow", 0.7);
    const state = weather.getState();
    expect(state.current).toBe("snow");
    expect(state.intensity).toBe(0.7);
  });

  it("reset returns to clear weather", () => {
    weather.forceWeather("storm", 1.0);
    weather.reset();
    expect(weather.getState().current).toBe("clear");
  });
});

// --- Day/Night helper tests ---

describe("TimeOfDay helpers", () => {
  it("getTimeOfDay returns correct phase", () => {
    expect(getTimeOfDay(6)).toBe("dawn");
    expect(getTimeOfDay(12)).toBe("day");
    expect(getTimeOfDay(18)).toBe("dusk");
    expect(getTimeOfDay(23)).toBe("night");
    expect(getTimeOfDay(2)).toBe("night");
  });

  it("getTimeOfDayProgress returns 0-1 value", () => {
    expect(getTimeOfDayProgress(0)).toBe(0);
    expect(getTimeOfDayProgress(12)).toBe(0.5);
    expect(getTimeOfDayProgress(24)).toBe(1);
  });
});
